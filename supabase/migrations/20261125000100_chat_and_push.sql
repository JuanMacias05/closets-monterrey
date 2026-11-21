-- In-platform chat and web push subscriptions (roadmap item 5, approved 2026-11-20).
--
-- Until now buyers, sellers and couriers talked on WhatsApp. The owner wants the platform to be
-- the main channel (WhatsApp stays only as a secondary link), so each order gets its own chat:
--   * 'order'  : buyer <-> seller, one per reservation, from the moment it is made.
--   * 'pickup' : seller <-> courier, one per reservation, from the moment the courier accepts.
-- Messages arrive live through Supabase Realtime (the messages table is in its publication;
-- Realtime applies the same row security as a normal read).
--
-- Decisions:
--   * IMPORTANT: only the participants read or write a conversation. Nobody else, admins
--     included: the owner wants admins to read a chat only when someone reports it, which comes
--     later with reporting. Participants are derived from the reservation every time (never
--     stored), so a courier who was asked but did not accept never gets in.
--   * Text only for now (up to 1,000 characters). Photos come later.
--   * Writing stays open 30 days after the reservation closes, to sort out a late problem;
--     reading stays open for good.
--   * Push notifications are sent by the app server (VAPID keys live there), not from SQL. This
--     migration only stores each device's subscription.

create type public.conversation_kind as enum ('order', 'pickup');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  kind public.conversation_kind not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (reservation_id, kind)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  -- null once the sender deleted her account; the message stays for the other side.
  sender_id uuid references auth.users (id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 1000),
  -- The wall clock, not the transaction's start: two messages in one transaction (or a reply
  -- inside a test) must still come out in order for the unread count.
  created_at timestamptz not null default clock_timestamp()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- How far each participant has read: what "unread" counts from.
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- The caller's role in a conversation ('buyer', 'seller' or 'courier'), or null if she is not in
-- it. A courier is in a pickup chat only while she is the reservation's accepted courier.
create function private.conversation_role(target uuid, who uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.kind = 'order' and r.buyer_id = who then 'buyer'
    when r.seller_id = who then 'seller'
    when c.kind = 'pickup' and r.courier_id = who and r.courier_accepted_at is not null then 'courier'
  end
  from public.conversations c
  join public.reservations r on r.id = c.reservation_id
  where c.id = target;
$$;

create function private.conversation_open_for_writing(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    join public.reservations r on r.id = c.reservation_id
    where c.id = target and (r.closed_at is null or r.closed_at > now() - interval '30 days')
  );
$$;

grant execute on function private.conversation_role(uuid, uuid) to authenticated;
grant execute on function private.conversation_open_for_writing(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;

create policy "Participants read their conversations"
on public.conversations for select to authenticated
using (private.conversation_role(id, (select auth.uid())) is not null);

create policy "Participants read their messages"
on public.messages for select to authenticated
using (private.conversation_role(conversation_id, (select auth.uid())) is not null);

create policy "Participants write as themselves"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and private.conversation_role(conversation_id, (select auth.uid())) is not null
  and private.conversation_open_for_writing(conversation_id)
);

create policy "Each reads her own read marks"
on public.conversation_reads for select to authenticated
using (user_id = (select auth.uid()));

revoke all on public.conversations, public.messages, public.conversation_reads from anon, authenticated;
grant select on public.conversations, public.messages, public.conversation_reads to authenticated;
-- Only these columns: created_at stays the server's clock, so nobody back-dates a message to
-- dodge the unread count.
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

-- Conversations open by themselves: the order chat with the reservation, the pickup chat when the
-- courier accepts.
create function private.open_reservation_conversations()
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
    insert into public.conversations (reservation_id, kind) values (new.id, 'pickup') on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger reservations_open_conversations
after insert or update of courier_accepted_at on public.reservations
for each row execute function private.open_reservation_conversations();

create function private.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  -- Sending counts as having read everything up to your own message.
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (new.conversation_id, new.sender_id, new.created_at)
  on conflict (conversation_id, user_id) do update set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
  return new;
end;
$$;

create trigger messages_touch_conversation
after insert on public.messages
for each row when (new.sender_id is not null)
execute function private.touch_conversation();

-- Existing reservations get their chats too.
insert into public.conversations (reservation_id, kind)
select id, 'order' from public.reservations
on conflict do nothing;
insert into public.conversations (reservation_id, kind)
select id, 'pickup' from public.reservations where courier_accepted_at is not null
on conflict do nothing;

-- The caller's conversations with her role, the unread count and the last message, newest first.
-- One call serves the lists and the menu badges.
create function public.my_conversations()
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
    (select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
    (select count(*)::integer from public.messages m
     where m.conversation_id = c.id
       and m.sender_id is distinct from (select auth.uid())
       and m.created_at > coalesce(cr.last_read_at, '-infinity'::timestamptz))
  from public.conversations c
  join public.reservations r on r.id = c.reservation_id
  left join public.conversation_reads cr on cr.conversation_id = c.id and cr.user_id = (select auth.uid())
  cross join lateral (
    select case
      when c.kind = 'order' and r.buyer_id = (select auth.uid()) then 'buyer'
      when r.seller_id = (select auth.uid()) then 'seller'
      when c.kind = 'pickup' and r.courier_id = (select auth.uid()) and r.courier_accepted_at is not null then 'courier'
    end as name
  ) role
  where role.name is not null
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

create function public.mark_conversation_read(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or private.conversation_role(target, caller) is null then raise exception 'not_found'; end if;
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (target, caller, clock_timestamp())
  on conflict (conversation_id, user_id) do update set last_read_at = clock_timestamp();
end;
$$;

revoke all on function public.my_conversations() from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Live messages. The guard keeps the migration applying on a Postgres without Supabase's
-- publication (the chat then still works on reload).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Web push subscriptions
-- ---------------------------------------------------------------------------------------

-- One row per browser/device that said yes to notifications. The app server reads them with the
-- secret key to send pushes; a client only sees and removes its own.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) between 1 and 200),
  auth text not null check (length(auth) between 1 and 100),
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Each reads her own push subscriptions"
on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));

create policy "Each removes her own push subscriptions"
on public.push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- Saving goes through a function: an endpoint belongs to a browser, and when someone else signs
-- in on that browser the subscription must move to her (a plain upsert would hit the previous
-- owner's row, which row security hides).
create function public.save_push_subscription(endpoint text, p256dh text, auth_secret text, user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (caller, endpoint, p256dh, auth_secret, left(user_agent, 300))
  on conflict on constraint push_subscriptions_endpoint_key do update
    set user_id = caller, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
