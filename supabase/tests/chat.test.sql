begin;
select plan(30);

-- Chat (20261125000100): an order chat buyer <-> seller per reservation, a pickup chat
-- seller <-> courier once the courier accepts. Only participants read or write.
-- Seeded: Renata (seller 1, Padre Mier) and Lupita (courier 6, covers Monterrey).
insert into auth.users (id, aud, role, phone, raw_user_meta_data) values
  ('93000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', '528100000291', '{"account_type":"buyer","full_name":"Compradora Chat","facebook_url":"https://facebook.com/compradora.chat"}'),
  ('93000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', '528100000292', '{"account_type":"buyer","full_name":"Otra Compradora","facebook_url":"https://facebook.com/otra.compradora"}');

insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn, publication_status) values
  ('94000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pieza-chat-uno', 'Pieza chat uno', 'tops', 'M', 'new', 30000, 'published');
insert into public.cart_items (buyer_id, product_id) values ('93000000-0000-4000-8000-0000000000b1', '94000000-0000-4000-8000-000000000001');

create temporary table ids (name text primary key, id uuid);
grant select on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select lives_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'courier', null, 'Calle Chat 12, Centro', '10000000-0000-4000-8000-000000000006', 'Monterrey', 'on_delivery') $$,
  'The buyer reserves with a courier.'
);

reset role;
insert into ids select 'r', id from public.reservations where buyer_id = '93000000-0000-4000-8000-0000000000b1';
insert into ids select 'order', id from public.conversations where reservation_id = (select id from ids where name = 'r') and kind = 'order';
select is((select count(*)::integer from ids where name = 'order'), 1, 'The order chat opens with the reservation.');
select is((select count(*)::integer from public.conversations where reservation_id = (select id from ids where name = 'r') and kind = 'pickup'), 0, 'No pickup chat while the courier has not accepted.');

-- Who is in the order chat.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::integer from public.conversations where id = (select id from ids where name = 'order')), 1, 'The buyer sees her order chat.');
select lives_ok(
  $$ insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'order'), '93000000-0000-4000-8000-0000000000b1', '¿Me la puedes apartar hasta el viernes?') $$,
  'The buyer writes to the seller.'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'order'), '10000000-0000-4000-8000-000000000001', 'Suplantando') $$,
  '42501', null, 'Nobody writes as someone else.'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'order'), '93000000-0000-4000-8000-0000000000b1', '   ') $$,
  '23514', null, 'An empty message is refused.'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body, created_at) values ((select id from ids where name = 'order'), '93000000-0000-4000-8000-0000000000b1', 'Viejo', now() - interval '1 day') $$,
  '42501', null, 'A message cannot be back-dated.'
);
select is((select unread from public.my_conversations() where conversation_id = (select id from ids where name = 'order')), 0, 'Her own message is not unread for her.');

select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::integer from public.messages where conversation_id = (select id from ids where name = 'order')), 0, 'Another buyer cannot read it.');
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'order'), '93000000-0000-4000-8000-0000000000b2', 'Hola') $$,
  '42501', null, 'Nor write in it.'
);
select throws_ok($$ select public.mark_conversation_read((select id from ids where name = 'order')) $$, 'P0001', 'not_found', 'Nor mark it read.');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select count(*)::integer from public.messages where conversation_id = (select id from ids where name = 'order')), 0, 'The courier is not in the buyer-seller chat.');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select row(my_role, unread, last_body)::text from public.my_conversations() where conversation_id = (select id from ids where name = 'order')),
  row('seller', 1, '¿Me la puedes apartar hasta el viernes?')::text,
  'The seller sees it with one unread message.'
);
select lives_ok($$ select public.mark_conversation_read((select id from ids where name = 'order')) $$, 'The seller opens it.');
select is((select unread from public.my_conversations() where conversation_id = (select id from ids where name = 'order')), 0, 'Then nothing is unread.');
select lives_ok(
  $$ insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'order'), '10000000-0000-4000-8000-000000000001', 'Sí, claro') $$,
  'The seller answers.'
);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select is((select unread from public.my_conversations() where conversation_id = (select id from ids where name = 'order')), 1, 'The answer is unread for the buyer.');

-- The pickup chat opens when the courier accepts, for the seller and the courier only.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select lives_ok(
  $$ select public.accept_courier_request((select id from public.courier_requests where reservation_id = (select id from ids where name = 'r'))) $$,
  'The courier accepts.'
);
reset role;
insert into ids select 'pickup', id from public.conversations where reservation_id = (select id from ids where name = 'r') and kind = 'pickup';
select is((select count(*)::integer from ids where name = 'pickup'), 1, 'Accepting opens the pickup chat.');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select my_role from public.my_conversations() where conversation_id = (select id from ids where name = 'pickup')), 'courier', 'The courier is in the pickup chat.');
select lives_ok(
  $$ insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'pickup'), '10000000-0000-4000-8000-000000000006', 'Paso a Padre Mier a las 6') $$,
  'The courier writes to the seller.'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.messages where conversation_id = (select id from ids where name = 'pickup')), 1, 'The seller reads the pickup chat.');
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::integer from public.messages where conversation_id = (select id from ids where name = 'pickup')), 0, 'The buyer is not in the pickup chat.');

-- Writing closes 30 days after the reservation closes; reading stays.
reset role;
update public.reservations set status = 'cancelled', closed_at = now() - interval '31 days' where id = (select id from ids where name = 'r');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'order'), '93000000-0000-4000-8000-0000000000b1', '¿Sigue?') $$,
  '42501', null, 'A chat closed for more than 30 days takes no new messages.'
);
select is((select count(*)::integer from public.messages where conversation_id = (select id from ids where name = 'order')), 2, 'But its history is still readable.');

-- Push subscriptions: each device belongs to whoever signed in on it last.
select lives_ok(
  $$ select public.save_push_subscription('https://push.example.com/abc', 'p256dh-key', 'auth-secret', 'Test') $$,
  'The buyer saves her device.'
);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::integer from public.push_subscriptions), 0, 'Nobody else sees it.');
select lives_ok(
  $$ select public.save_push_subscription('https://push.example.com/abc', 'p256dh-key-2', 'auth-secret-2') $$,
  'Another account signs in on the same browser and saves it.'
);
reset role;
select is(
  (select user_id::text from public.push_subscriptions where endpoint = 'https://push.example.com/abc'),
  '93000000-0000-4000-8000-0000000000b2', 'The subscription moves to her: one owner per device.'
);

select * from finish();
rollback;
