begin;
select plan(22);

-- The buyer <-> courier chat and photos in chats (20261126000200).
-- Seeded: Renata (seller 1, Padre Mier) and Lupita (courier 6, covers Monterrey).
insert into auth.users (id, aud, role, phone, raw_user_meta_data) values
  ('95000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', '528100000391', '{"account_type":"buyer","full_name":"Compradora Fotos","facebook_url":"https://facebook.com/compradora.fotos"}'),
  ('95000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', '528100000392', '{"account_type":"buyer","full_name":"Otra Fotos","facebook_url":"https://facebook.com/otra.fotos"}');
insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn, publication_status) values
  ('96000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pieza-fotos-uno', 'Pieza fotos uno', 'tops', 'M', 'new', 30000, 'published');
insert into public.cart_items (buyer_id, product_id) values ('95000000-0000-4000-8000-0000000000b1', '96000000-0000-4000-8000-000000000001');

create temporary table ids (name text primary key, id uuid, path text);
grant select on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'courier', null, 'Calle Foto 1, Centro', '10000000-0000-4000-8000-000000000006', 'Monterrey', 'on_delivery');

reset role;
insert into ids (name, id) select 'r', id from public.reservations where buyer_id = '95000000-0000-4000-8000-0000000000b1';
select is((select count(*)::integer from public.conversations where reservation_id = (select id from ids where name = 'r') and kind = 'delivery'), 0, 'No buyer-courier chat before the courier accepts.');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select public.accept_courier_request((select id from public.courier_requests where reservation_id = (select id from ids where name = 'r')));

reset role;
insert into ids (name, id) select kind::text, id from public.conversations where reservation_id = (select id from ids where name = 'r');
update ids set path = id::text || '/a1000000-0000-4000-8000-000000000001.jpg' where name = 'delivery';
update ids set path = id::text || '/a1000000-0000-4000-8000-000000000002.jpg' where name = 'order';
select is((select count(*)::integer from ids where name in ('order', 'pickup', 'delivery')), 3, 'Accepting opens the buyer-courier chat next to the seller-courier one.');

-- Who is in the delivery chat.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select is((select my_role from public.my_conversations() where conversation_id = (select id from ids where name = 'delivery')), 'buyer', 'The buyer is in it.');
select lives_ok(
  $$ insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'delivery'), '95000000-0000-4000-8000-0000000000b1', 'Estoy en casa después de las 6') $$,
  'The buyer writes to her courier.'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select row(my_role, unread)::text from public.my_conversations() where conversation_id = (select id from ids where name = 'delivery')), row('courier', 1)::text, 'The courier is in it, with the message unread.');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.my_conversations() where conversation_id = (select id from ids where name = 'delivery')), 0, 'The seller is not in the buyer-courier chat.');
select is((select count(*)::integer from public.messages where conversation_id = (select id from ids where name = 'delivery')), 0, 'Nor can she read it.');
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'delivery'), '10000000-0000-4000-8000-000000000001', 'Hola') $$,
  '42501', null, 'Nor write in it.'
);

-- Photos: only participants upload to the chat's folder.
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('chat-photos', (select path from ids where name = 'delivery'), '10000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'The seller cannot upload into the buyer-courier chat.'
);
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('chat-photos', (select path from ids where name = 'delivery'), '95000000-0000-4000-8000-0000000000b2') $$,
  '42501', null, 'Nor can a stranger.'
);
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('chat-photos', (select path from ids where name = 'delivery'), '95000000-0000-4000-8000-0000000000b1') $$,
  'The buyer uploads a photo to her chat with the courier.'
);
select lives_ok(
  $$ insert into public.messages (conversation_id, sender_id, image_path) values ((select id from ids where name = 'delivery'), '95000000-0000-4000-8000-0000000000b1', (select path from ids where name = 'delivery')) $$,
  'And sends it without text.'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, image_path) values ((select id from ids where name = 'order'), '95000000-0000-4000-8000-0000000000b1', (select path from ids where name = 'delivery')) $$,
  '42501', null, 'A photo from one chat cannot be shown in another.'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id) values ((select id from ids where name = 'delivery'), '95000000-0000-4000-8000-0000000000b1') $$,
  '23514', null, 'A message needs text or a photo.'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, image_path) values ((select id from ids where name = 'delivery'), '10000000-0000-4000-8000-000000000006', (select path from ids where name = 'delivery')) $$,
  '42501', null, 'The courier cannot send the buyer''s file as her own.'
);
select is((select count(*)::integer from storage.objects where bucket_id = 'chat-photos' and name = (select path from ids where name = 'delivery')), 1, 'The courier can read the photo (to sign its URL).');
select is((select last_body from public.my_conversations() where conversation_id = (select id from ids where name = 'delivery')), '📷 Foto', 'A photo without text shows as "📷 Foto" in the list.');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from storage.objects where bucket_id = 'chat-photos' and name = (select path from ids where name = 'delivery')), 0, 'The seller cannot read it.');

-- 30 days after closing: no more uploads, and the nightly purge removes the photos.
reset role;
update public.reservations set status = 'cancelled', closed_at = now() - interval '31 days' where id = (select id from ids where name = 'r');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('chat-photos', (select id from ids where name = 'delivery')::text || '/a1000000-0000-4000-8000-000000000009.jpg', '95000000-0000-4000-8000-0000000000b1') $$,
  '42501', null, 'A chat closed for more than 30 days takes no new photos.'
);

reset role;
select is(private.purge_closed_chat_photos(), 1, 'The purge clears the photo message of the closed chat.');
select ok(
  (select image_path is null and image_purged_at is not null from public.messages where conversation_id = (select id from ids where name = 'delivery') and body is null),
  'The message stays, marked as purged.'
);
select is((select count(*)::integer from private.chat_photo_deletions where object_name = (select path from ids where name = 'delivery')), 1, 'Its file is queued for the Storage API.');

select * from finish();
rollback;
