-- Deposit proofs are deleted 15 days after the reservation was delivered.
--
-- A proof is a photo of a bank transfer or an OXXO ticket: it shows names, account digits and
-- amounts. Once the garments are delivered and the sale had two weeks to surface a problem,
-- nobody needs it, so it goes. The reservation stays (sales history, trust light, ratings);
-- only the image and the pointer to it are removed, and `proof_purged_at` records when, so the
-- screens say "Comprobante eliminado por privacidad" instead of showing a broken image.
--
-- How the files are removed, and why it takes two steps:
--
--   Supabase blocks DELETE on storage.objects from SQL (trigger storage.protect_delete:
--   "Direct deletion from storage tables is not allowed. Use the Storage API instead."). The
--   row is only the index; the file itself lives in the storage backend, so deleting the row
--   would leave the image behind with nothing pointing at it. Files must go through the
--   Storage API.
--
--   So the nightly job (pg_cron) first clears the reservation's pointer and queues every file
--   under "<reservation id>/" in private.deposit_proof_deletions, all in SQL. Then, when the
--   project URL and a secret key are in Supabase Vault, it asks the Storage API to delete the
--   queued files with pg_net (the same call supabase-js remove() makes). pg_net is
--   asynchronous, so a file leaves the queue on a later run, once its storage.objects row is
--   gone; a failed call is simply retried the next night.
--
--   Without the Vault secrets (the local stack, or production before the owner adds them) the
--   job still clears pointers and queues files; nothing is lost, the files wait in the queue.

alter table public.reservations add column proof_purged_at timestamptz;

grant select (proof_purged_at) on public.reservations to authenticated;

create table private.deposit_proof_deletions (
  object_name text primary key,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  -- pg_net request id of the last attempt, to look the answer up in net._http_response.
  last_request_id bigint
);

-- Bookkeeping for the job only: no client ever reads or writes it.
alter table private.deposit_proof_deletions enable row level security;
revoke all on table private.deposit_proof_deletions from public, anon, authenticated;

create function private.purge_delivered_deposit_proofs(keep_for interval default interval '15 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged integer;
  project_url text;
  secret_key text;
  request_headers jsonb;
  batch text[];
  request_id bigint;
begin
  -- Files the Storage API already removed leave the queue.
  delete from private.deposit_proof_deletions d
  where not exists (
    select 1 from storage.objects o where o.bucket_id = 'payment-proofs' and o.name = d.object_name
  );

  -- IMPORTANT: a reservation with an open support request keeps its proof. It is the evidence
  -- the admin needs to settle the request; it is purged on the first run after it's resolved.
  with doomed as (
    select r.id
    from public.reservations r
    where r.status = 'completed'
      and r.closed_at < now() - keep_for
      and r.proof_purged_at is null
      and (
        r.proof_submitted_at is not null
        -- An upload whose submit failed still left a file behind.
        or exists (
          select 1 from storage.objects o
          where o.bucket_id = 'payment-proofs' and o.name like r.id::text || '/%'
        )
      )
      and not exists (
        select 1 from public.support_requests s where s.reservation_id = r.id and s.status = 'open'
      )
    for update of r skip locked
  ), queued as (
    -- Every file under the reservation's folder, not only proof_path: a replaced or rejected
    -- proof stays in the bucket when the buyer uploads a new one.
    insert into private.deposit_proof_deletions (object_name)
    select o.name
    from storage.objects o
    join doomed on o.name like doomed.id::text || '/%'
    where o.bucket_id = 'payment-proofs'
    on conflict (object_name) do nothing
  )
  update public.reservations r
  set proof_path = null, proof_purged_at = now()
  from doomed
  where r.id = doomed.id;
  get diagnostics purged = row_count;

  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return purged;
  end if;

  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'proof_purge_project_url';
  select decrypted_secret into secret_key from vault.decrypted_secrets where name = 'proof_purge_secret_key';
  if project_url is null or secret_key is null then
    raise notice 'Vault secrets proof_purge_project_url / proof_purge_secret_key are not set; deposit proof files stay queued.';
    return purged;
  end if;

  -- A legacy service_role key is a JWT and also goes as the bearer token. A new secret key
  -- (sb_secret_...) is not a JWT and goes in apikey only; the API gateway swaps it for one.
  request_headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', secret_key)
    || case when secret_key like 'eyJ%' then jsonb_build_object('Authorization', 'Bearer ' || secret_key) else '{}'::jsonb end;

  -- The Storage API deletes up to 1000 paths per call; 500 keeps each request small.
  for batch in
    select array_agg(object_name order by object_name)
    from (
      select object_name, (row_number() over (order by object_name) - 1) / 500 as chunk
      from private.deposit_proof_deletions
    ) numbered
    group by chunk
  loop
    select net.http_delete(
      url := rtrim(project_url, '/') || '/storage/v1/object/payment-proofs',
      headers := request_headers,
      body := jsonb_build_object('prefixes', to_jsonb(batch)),
      timeout_milliseconds := 30000
    ) into request_id;

    update private.deposit_proof_deletions
    set attempts = attempts + 1, last_attempt_at = now(), last_request_id = request_id
    where object_name = any (batch);
  end loop;

  return purged;
end;
$$;

-- Only the scheduled job runs it (as postgres). Functions are executable by PUBLIC by default.
revoke execute on function private.purge_delivered_deposit_proofs(interval) from public, anon, authenticated;

-- Supabase ships pg_cron and pg_net; the guards keep this migration applying on a Postgres
-- without them (the purge can then be run by hand).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  else
    raise notice 'pg_net is not available: proof files will stay queued in private.deposit_proof_deletions.';
  end if;

  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- 09:30 UTC = 03:30 in Monterrey: nobody is reserving, and Vault/pg_net calls don't
    -- compete with the day's traffic. cron.schedule with a name replaces an existing job.
    perform cron.schedule(
      'purge-delivered-deposit-proofs',
      '30 9 * * *',
      'select private.purge_delivered_deposit_proofs()'
    );
  else
    raise notice 'pg_cron is not available: schedule select private.purge_delivered_deposit_proofs() by hand.';
  end if;
end;
$$;
