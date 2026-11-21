-- Photos in the chat and a buyer <-> courier chat (approved 2026-11-21).
--
-- 1. Buyer <-> courier ('delivery'): one per reservation, opened when the courier accepts, the
--    same moment she gets the buyer's name and address. The seller is not in it, and admins
--    still read no chat.
-- 2. Photos: any message in any of the three chats can carry one photo (with or without text).
--    The browser shrinks it to a JPEG of at most 300 KB (prepareProductImage, as for deposit
--    proofs) and uploads it to the private bucket chat-photos at <conversation id>/<uuid>.jpg.
--    Only the conversation's participants can upload there (while the chat takes messages) or
--    read it, through short-lived signed URLs. A message can only point at a photo its sender
--    uploaded to that same conversation.
-- 3. IMPORTANT (privacy): chat photos are deleted 30 days after the reservation closes, when
--    the chat also stops taking messages (20261125000100). Same two-step pattern as deposit
--    proofs (20261121000100): the nightly job clears the message's pointer, stamps
--    image_purged_at (the thread then says "Foto eliminada por privacidad") and queues the files;
--    then it asks the Storage API to delete them with pg_net, using the Vault secrets the proof
--    purge already uses. A reservation with an open support request keeps its photos until it
--    is resolved: they may be the evidence. The text of the messages stays.

-- ---------------------------------------------------------------------------------------
-- Who is in which chat
-- ---------------------------------------------------------------------------------------

create or replace function private.conversation_role(target uuid, who uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.kind in ('order', 'delivery') and r.buyer_id = who then 'buyer'
    when c.kind in ('order', 'pickup') and r.seller_id = who then 'seller'
    when c.kind in ('pickup', 'delivery') and r.courier_id = who and r.courier_accepted_at is not null then 'courier'
  end
  from public.conversations c
  join public.reservations r on r.id = c.reservation_id
  where c.id = target;
$$;

create or replace function private.open_reservation_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.conversations (reservation_id, kind) values (new.id, 'order') on conflict do nothing;
  end if;
  if new.courier_accepted_at is not null and (tg_op = 'INSERT' or old.courier_accepted_at is null) then
    insert into public.conversations (reservation_id, kind) values (new.id, 'pickup'), (new.id, 'delivery') on conflict do nothing;
  end if;
  return new;
end;
$$;

insert into public.conversations (reservation_id, kind)
select id, 'delivery' from public.reservations where courier_accepted_at is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------------------
-- Messages with a photo
-- ---------------------------------------------------------------------------------------

alter table public.messages
  alter column body drop not null,
  drop constraint messages_body_check,
  add constraint messages_body_check check (body is null or length(trim(body)) between 1 and 1000),
  add column image_path text check (
    image_path is null
    or image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.jpg$'
  ),
  add column image_purged_at timestamptz,
  add constraint messages_has_content check (body is not null or image_path is not null or image_purged_at is not null);

grant insert (image_path) on public.messages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-photos', 'chat-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The conversation a chat photo belongs to, or null for a malformed path (a bad cast must not
-- raise inside a storage policy).
create function private.chat_photo_conversation(object_name text)
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

create function private.can_upload_chat_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.conversation_role(private.chat_photo_conversation(object_name), (select auth.uid())) is not null
    and private.conversation_open_for_writing(private.chat_photo_conversation(object_name));
$$;

create function private.can_read_chat_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.conversation_role(private.chat_photo_conversation(object_name), (select auth.uid())) is not null;
$$;

-- A message may only show a photo its sender uploaded to this very conversation: nobody can
-- point a message at someone else's file, or at one from another chat.
create function private.chat_photo_attachable(target uuid, path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.chat_photo_conversation(path) = target and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'chat-photos' and o.name = path and o.owner_id = (select auth.uid())::text
  );
$$;

grant execute on function private.chat_photo_conversation(text) to authenticated;
grant execute on function private.can_upload_chat_photo(text) to authenticated;
grant execute on function private.can_read_chat_photo(text) to authenticated;
grant execute on function private.chat_photo_attachable(uuid, text) to authenticated;

create policy "Chat participants upload photos while the chat is open"
on storage.objects for insert to authenticated
with check (bucket_id = 'chat-photos' and private.can_upload_chat_photo(name));

create policy "Chat participants read its photos"
on storage.objects for select to authenticated
using (bucket_id = 'chat-photos' and private.can_read_chat_photo(name));

drop policy "Participants write as themselves" on public.messages;
create policy "Participants write as themselves"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and private.conversation_role(conversation_id, (select auth.uid())) is not null
  and private.conversation_open_for_writing(conversation_id)
  and (image_path is null or private.chat_photo_attachable(conversation_id, image_path))
);

-- Same as 20261125000100 with the delivery chat and photo messages ("📷 Foto" as the preview).
create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  reservation_id uuid,
  kind public.conversation_kind,
  my_role text,
  last_message_at timestamptz,
  last_body text,
  unread integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.reservation_id, c.kind, role.name, c.last_message_at,
    (select coalesce(m.body, '📷 Foto') from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
    (select count(*)::integer from public.messages m
     where m.conversation_id = c.id
       and m.sender_id is distinct from (select auth.uid())
       and m.created_at > coalesce(cr.last_read_at, '-infinity'::timestamptz))
  from public.conversations c
  join public.reservations r on r.id = c.reservation_id
  left join public.conversation_reads cr on cr.conversation_id = c.id and cr.user_id = (select auth.uid())
  cross join lateral (
    select case
      when c.kind in ('order', 'delivery') and r.buyer_id = (select auth.uid()) then 'buyer'
      when c.kind in ('order', 'pickup') and r.seller_id = (select auth.uid()) then 'seller'
      when c.kind in ('pickup', 'delivery') and r.courier_id = (select auth.uid()) and r.courier_accepted_at is not null then 'courier'
    end as name
  ) role
  where role.name is not null
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

-- ---------------------------------------------------------------------------------------
-- Purge: chat photos go 30 days after the reservation closes
-- ---------------------------------------------------------------------------------------

create table private.chat_photo_deletions (
  object_name text primary key,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  last_request_id bigint
);

alter table private.chat_photo_deletions enable row level security;
revoke all on table private.chat_photo_deletions from public, anon, authenticated;

create function private.purge_closed_chat_photos(keep_for interval default interval '30 days')
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
  delete from private.chat_photo_deletions d
  where not exists (select 1 from storage.objects o where o.bucket_id = 'chat-photos' and o.name = d.object_name);

  -- Every file under each closed conversation's folder, not only those a message points to: a
  -- photo uploaded whose message never got sent is left there too.
  with closed as (
    select c.id
    from public.conversations c
    join public.reservations r on r.id = c.reservation_id
    where r.closed_at < now() - keep_for
      and not exists (select 1 from public.support_requests s where s.reservation_id = r.id and s.status = 'open')
  ), queued as (
    insert into private.chat_photo_deletions (object_name)
    select o.name from storage.objects o join closed on o.name like closed.id::text || '/%'
    where o.bucket_id = 'chat-photos'
    on conflict (object_name) do nothing
  )
  update public.messages m
  set image_path = null, image_purged_at = now()
  from closed
  where m.conversation_id = closed.id and m.image_path is not null;
  get diagnostics purged = row_count;

  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return purged;
  end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'proof_purge_project_url';
  select decrypted_secret into secret_key from vault.decrypted_secrets where name = 'proof_purge_secret_key';
  if project_url is null or secret_key is null then
    raise notice 'Vault secrets proof_purge_project_url / proof_purge_secret_key are not set; chat photo files stay queued.';
    return purged;
  end if;

  -- See 20261121000100 for why the key goes as apikey and, if it is a JWT, as bearer too.
  request_headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', secret_key)
    || case when secret_key like 'eyJ%' then jsonb_build_object('Authorization', 'Bearer ' || secret_key) else '{}'::jsonb end;

  for batch in
    select array_agg(object_name order by object_name)
    from (
      select object_name, (row_number() over (order by object_name) - 1) / 500 as chunk
      from private.chat_photo_deletions
    ) numbered
    group by chunk
  loop
    select net.http_delete(
      url := rtrim(project_url, '/') || '/storage/v1/object/chat-photos',
      headers := request_headers,
      body := jsonb_build_object('prefixes', to_jsonb(batch)),
      timeout_milliseconds := 30000
    ) into request_id;

    update private.chat_photo_deletions
    set attempts = attempts + 1, last_attempt_at = now(), last_request_id = request_id
    where object_name = any (batch);
  end loop;

  return purged;
end;
$$;

revoke execute on function private.purge_closed_chat_photos(interval) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 09:45 UTC = 03:45 in Monterrey, after the deposit-proof purge.
    perform cron.schedule('purge-closed-chat-photos', '45 9 * * *', 'select private.purge_closed_chat_photos()');
  else
    raise notice 'pg_cron is not available: schedule select private.purge_closed_chat_photos() by hand.';
  end if;
end;
$$;
