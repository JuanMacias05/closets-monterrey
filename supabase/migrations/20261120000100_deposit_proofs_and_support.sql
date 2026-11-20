-- Deposit proofs, cash deposits at OXXO and support requests.
--
-- A buyer can now upload a photo of her transfer (or her OXXO ticket) to the reservation, and
-- the seller confirms or rejects it from her panel. Sellers can add a 16-digit card number so
-- buyers without a bank app can pay the deposit in cash at OXXO, which deposits to a card,
-- not to a CLABE. When a proof is rejected or nobody reviews it, the buyer can ask for help;
-- with no support team yet, those requests land in the admin panel.

-- ---------------------------------------------------------------------------------------
-- Card number for OXXO deposits
-- ---------------------------------------------------------------------------------------

-- 16 digits with a valid Luhn check digit, so a mistyped card is refused before a buyer pays
-- cash into it.
create function private.is_valid_card_number(p_card text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select p_card ~ '^[0-9]{16}$'
    and (
      select sum(
        case when (16 - g.i) % 2 = 1
          then case when d * 2 > 9 then d * 2 - 9 else d * 2 end
          else d
        end
      ) % 10 = 0
      from generate_series(1, 16) as g(i),
        lateral (select substring(p_card from g.i for 1)::integer as d) as digit
    );
$$;

grant execute on function private.is_valid_card_number(text) to authenticated, service_role;

alter table public.seller_private_settings
  add column oxxo_card text,
  add constraint seller_oxxo_card_format check (oxxo_card is null or private.is_valid_card_number(oxxo_card));

-- ---------------------------------------------------------------------------------------
-- Proof of the deposit on the reservation
-- ---------------------------------------------------------------------------------------

alter table public.reservations
  -- Snapshot, like deposit_clabe: the buyer must see where to pay even if the seller edits it.
  add column deposit_oxxo_card text,
  add column proof_path text,
  add column proof_method text check (proof_method in ('transfer', 'oxxo')),
  -- SPEI tracking key or OXXO ticket folio, whichever the buyer typed. Optional.
  add column proof_reference text check (proof_reference is null or length(proof_reference) between 1 and 40),
  add column proof_submitted_at timestamptz,
  add column proof_rejected_at timestamptz,
  add column proof_rejection_reason text check (proof_rejection_reason is null or length(proof_rejection_reason) between 1 and 160);

-- Reservations are read column by column (20261118000200 hides delivery_pin), so new columns
-- need their own grant. Row policies still limit who sees which reservation.
grant select (
  deposit_oxxo_card, proof_path, proof_method, proof_reference,
  proof_submitted_at, proof_rejected_at, proof_rejection_reason
) on public.reservations to authenticated;

create function private.snapshot_deposit_oxxo_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select oxxo_card into new.deposit_oxxo_card
  from public.seller_private_settings
  where seller_id = new.seller_id;
  return new;
end;
$$;

-- A trigger instead of another copy of reserve_cart_from_seller: that function is long and
-- the snapshot is the only thing it would change.
create trigger reservations_snapshot_oxxo_card
before insert on public.reservations
for each row execute function private.snapshot_deposit_oxxo_card();

-- IMPORTANT (24 h rule): a reservation whose proof is waiting for the seller's review does
-- not expire. The buyer already paid; a slow seller must not cost her the garment. A rejected
-- proof restarts the normal rule, and the admin panel lists proofs left unreviewed for 48 h.
create or replace function public.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale record;
  released integer := 0;
begin
  for stale in
    select id from public.reservations
    where status = 'pending_deposit' and expires_at < now()
      and (proof_submitted_at is null or proof_rejected_at is not null)
    for update skip locked
  loop
    perform private.release_reservation(stale.id, 'expired');
    released := released + 1;
  end loop;
  return released;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Private storage for proofs
-- ---------------------------------------------------------------------------------------

-- Private: proofs show bank details. Objects live at <reservation id>/<uuid>.jpg and are read
-- through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 1048576, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The reservation an object belongs to, or null for a malformed path (a bad cast must not
-- raise inside a storage policy).
create function private.proof_reservation_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.jpg$'
      then split_part(object_name, '/', 1)::uuid
  end;
$$;

create function private.can_upload_deposit_proof(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reservations r
    where r.id = private.proof_reservation_id(object_name)
      and r.buyer_id = (select auth.uid())
      and r.status = 'pending_deposit'
  );
$$;

create function private.can_read_deposit_proof(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.reservations r
    where r.id = private.proof_reservation_id(object_name)
      and (r.buyer_id = (select auth.uid()) or r.seller_id = (select auth.uid()))
  );
$$;

grant execute on function private.proof_reservation_id(text) to authenticated;
grant execute on function private.can_upload_deposit_proof(text) to authenticated;
grant execute on function private.can_read_deposit_proof(text) to authenticated;

create policy "Buyers upload proofs for their pending reservations"
on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and private.can_upload_deposit_proof(name));

create policy "Buyer, seller and admins read a reservation's proofs"
on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and private.can_read_deposit_proof(name));

-- By uploader, not by reservation: a shopper deleting her account removes her proofs right
-- after delete_my_buyer_account() has unlinked her from the reservation.
create policy "Uploaders and admins delete proofs"
on storage.objects for delete to authenticated
using (bucket_id = 'payment-proofs' and (owner_id = (select auth.uid())::text or (select private.is_admin())));

-- ---------------------------------------------------------------------------------------
-- Submitting and rejecting a proof
-- ---------------------------------------------------------------------------------------

create function public.submit_deposit_proof(target uuid, path text, method text, reference text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r record;
  clean_reference text := nullif(trim(coalesce(reference, '')), '');
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  perform public.release_expired_reservations();

  select * into r from public.reservations where id = target for update;
  if not found or r.buyer_id is distinct from caller then raise exception 'not_found'; end if;
  if r.status <> 'pending_deposit' then raise exception 'not_pending'; end if;
  if method not in ('transfer', 'oxxo') then raise exception 'invalid_method'; end if;
  if method = 'oxxo' and r.deposit_oxxo_card is null then raise exception 'invalid_method'; end if;
  if clean_reference is not null and length(clean_reference) > 40 then raise exception 'invalid_reference'; end if;
  if private.proof_reservation_id(path) is distinct from target
     or not exists (select 1 from storage.objects o where o.bucket_id = 'payment-proofs' and o.name = path) then
    raise exception 'invalid_proof';
  end if;

  update public.reservations
  set proof_path = path,
      proof_method = method,
      proof_reference = clean_reference,
      proof_submitted_at = now(),
      proof_rejected_at = null,
      proof_rejection_reason = null
  where id = target;
end;
$$;

-- The seller (or an admin) rejects a proof she can't match in her bank. The buyer gets at
-- least 12 more hours to upload another one, even if her original 24 h already ran out while
-- the proof was under review.
create function public.reject_deposit_proof(target uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r record;
  clean_reason text := nullif(trim(coalesce(reason, '')), '');
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if clean_reason is null or length(clean_reason) > 160 then raise exception 'invalid_reason'; end if;

  select * into r from public.reservations where id = target for update;
  if not found or not (r.seller_id = caller or private.is_admin()) then raise exception 'not_found'; end if;
  if r.status <> 'pending_deposit' or r.proof_submitted_at is null or r.proof_rejected_at is not null then
    raise exception 'nothing_to_reject';
  end if;

  update public.reservations
  set proof_rejected_at = now(),
      proof_rejection_reason = clean_reason,
      expires_at = greatest(expires_at, now() + interval '12 hours')
  where id = target;
end;
$$;

grant execute on function public.submit_deposit_proof(uuid, text, text, text) to authenticated;
grant execute on function public.reject_deposit_proof(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------
-- Support requests
-- ---------------------------------------------------------------------------------------

create type public.support_request_reason as enum ('proof_rejected', 'proof_not_reviewed', 'released_after_paying', 'other');

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations (id) on delete cascade,
  buyer_id uuid references auth.users (id) on delete set null,
  reason public.support_request_reason not null,
  message text not null check (length(trim(message)) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution_note text check (resolution_note is null or length(resolution_note) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index support_requests_open_idx on public.support_requests (status, created_at desc);
-- One open request per reservation: a second tap must not pile up duplicates for the admin.
create unique index support_requests_one_open_per_reservation
on public.support_requests (reservation_id) where status = 'open';

alter table public.support_requests enable row level security;

create policy "Buyer reads her requests, admins all"
on public.support_requests for select to authenticated
using (buyer_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.support_requests to authenticated;

create function public.request_support(target uuid, why public.support_request_reason, message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r record;
  clean_message text := trim(coalesce(message, ''));
  existing uuid;
  created uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if length(clean_message) < 5 or length(clean_message) > 1000 then raise exception 'invalid_message'; end if;

  select * into r from public.reservations where id = target;
  if not found or r.buyer_id is distinct from caller then raise exception 'not_found'; end if;

  select id into existing from public.support_requests where reservation_id = target and status = 'open';
  if existing is not null then return existing; end if;

  insert into public.support_requests (reservation_id, buyer_id, reason, message)
  values (target, caller, why, clean_message)
  returning id into created;
  return created;
end;
$$;

create function public.resolve_support_request(target uuid, note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  update public.support_requests
  set status = 'resolved', resolved_at = now(), resolution_note = nullif(trim(coalesce(note, '')), '')
  where id = target and status = 'open';
  if not found then raise exception 'not_found'; end if;
end;
$$;

grant execute on function public.request_support(uuid, public.support_request_reason, text) to authenticated;
grant execute on function public.resolve_support_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------
-- Account deletion clears proof references
-- ---------------------------------------------------------------------------------------

-- Same checks as 20261119000100; it now also drops the proof references, so nobody keeps a
-- pointer to a bank receipt of someone who left. The files themselves are removed by the
-- client right after (see the storage delete policy above).
create or replace function public.delete_my_buyer_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  override public.buyer_trust;
begin
  if caller is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.profiles where id = caller)
     or exists (select 1 from public.couriers where id = caller)
     or not exists (select 1 from public.buyer_profiles where id = caller) then
    raise exception 'not_a_buyer_account';
  end if;
  if exists (select 1 from public.reservations where buyer_id = caller and status in ('pending_deposit', 'confirmed')) then
    raise exception 'open_reservations';
  end if;
  select trust_override into override from public.buyer_profiles where id = caller;
  if override in ('red', 'yellow')
     or exists (select 1 from public.reservations where buyer_id = caller and status in ('no_show', 'expired')) then
    raise exception 'needs_manual_review';
  end if;

  perform set_config('closets.reservation_write', 'on', true);
  update public.reservations
  set delivery_address = null, buyer_municipality = null, delivery_pin = null,
      proof_path = null, proof_reference = null
  where buyer_id = caller;
  perform set_config('closets.reservation_write', 'off', true);

  delete from public.support_requests where buyer_id = caller;
  delete from auth.users where id = caller;
end;
$$;
