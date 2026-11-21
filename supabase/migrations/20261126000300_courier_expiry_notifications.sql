-- Push when a courier request runs out on its own (approved 2026-11-21).
--
-- Requests expire lazily (20261124000100): whoever next touches the site runs the expiry, so
-- there was no moment to tell the buyer "your courier didn't answer". Now pg_cron pings the
-- app every 5 minutes (pg_net POST to /api/cron/courier-expiry, with a shared secret). The app
-- calls claim_courier_expiry_notifications(), which runs the expiry and hands back, once each:
--   * requests that expired without an answer -> push to the buyer (choose another delivery)
--     and to the seller (her panel already says the buyer is choosing again);
--   * reservations released because the buyer didn't choose again within the 12 hours -> push
--     to the buyer and the seller (the garments are back on sale).
--
-- Decisions:
--   * IMPORTANT (idempotent): each row is stamped (expiry_notified_at / release_notified_at) in
--     the same UPDATE that hands it to the app, so two overlapping pings never notify twice.
--     The flip side: if sending fails after the claim, that push is lost (at most once). The
--     notice in /cuenta and the panel still shows it.
--   * Vercel Hobby crons run once a day, so the clock lives in the database, which already runs
--     pg_cron and pg_net for the proof purge.
--   * Without the Vault secrets courier_expiry_webhook_url / courier_expiry_webhook_secret (the
--     local stack, or production before the owner adds them) the ping does nothing; expiry
--     keeps working lazily as before, just without the push.
--   * Requests and releases that happened before this migration count as already notified, so
--     the first run doesn't send old news.

alter table public.courier_requests add column expiry_notified_at timestamptz;
alter table public.reservations add column release_notified_at timestamptz;

update public.courier_requests set expiry_notified_at = coalesce(resolved_at, now()) where status = 'expired';
update public.reservations set release_notified_at = coalesce(closed_at, now())
where status = 'expired' and delivery_method = 'courier' and courier_accepted_at is null;

create function public.claim_courier_expiry_notifications()
returns table (
  event text,
  reservation_id uuid,
  buyer_id uuid,
  seller_id uuid,
  courier_name text,
  store_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.release_expired_reservations();

  return query
  with claimed as (
    update public.courier_requests q
    set expiry_notified_at = now()
    where q.status = 'expired' and q.expiry_notified_at is null
    returning q.reservation_id, q.courier_id
  )
  select 'request_expired'::text, r.id, r.buyer_id, r.seller_id, c.full_name, p.store_name
  from claimed
  join public.reservations r on r.id = claimed.reservation_id
  join public.profiles p on p.id = r.seller_id
  left join public.couriers c on c.id = claimed.courier_id;

  -- Released on the 12-hour "choose again" deadline: a courier delivery that never got a yes
  -- after a courier said no or let it expire.
  return query
  with claimed as (
    update public.reservations r
    set release_notified_at = now()
    where r.status = 'expired' and r.delivery_method = 'courier' and r.courier_accepted_at is null
      and r.release_notified_at is null
      and exists (select 1 from public.courier_requests q where q.reservation_id = r.id and q.status in ('rejected', 'expired'))
    returning r.id, r.buyer_id, r.seller_id
  )
  select 'released_without_delivery'::text, claimed.id, claimed.buyer_id, claimed.seller_id, null::text, p.store_name
  from claimed
  join public.profiles p on p.id = claimed.seller_id;
end;
$$;

-- Only the app server (secret key) claims: anyone else could swallow the notifications.
revoke all on function public.claim_courier_expiry_notifications() from public, anon, authenticated;
grant execute on function public.claim_courier_expiry_notifications() to service_role;

create function private.ping_courier_expiry_webhook()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_url text;
  webhook_secret text;
  request_id bigint;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return null;
  end if;
  select decrypted_secret into webhook_url from vault.decrypted_secrets where name = 'courier_expiry_webhook_url';
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'courier_expiry_webhook_secret';
  -- Quietly: this runs every 5 minutes, and a missing secret is a normal state locally.
  if webhook_url is null or webhook_secret is null then
    return null;
  end if;
  select net.http_post(
    url := webhook_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || webhook_secret),
    timeout_milliseconds := 20000
  ) into request_id;
  return request_id;
end;
$$;

revoke execute on function private.ping_courier_expiry_webhook() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ping-courier-expiry', '*/5 * * * *', 'select private.ping_courier_expiry_webhook()');
  else
    raise notice 'pg_cron is not available: courier expiry pushes are not scheduled.';
  end if;
end;
$$;
