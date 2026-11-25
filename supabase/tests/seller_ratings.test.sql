begin;
select plan(16);

-- Seller ratings (20261128000100). Seeded: Renata (seller 1) and the admin (4).
insert into auth.users (id, aud, role, phone, raw_user_meta_data) values
  ('9a000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', '528100000691', '{"account_type":"buyer","full_name":"Compradora Estrellas","facebook_url":"https://facebook.com/compradora.estrellas"}'),
  ('9a000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', '528100000692', '{"account_type":"buyer","full_name":"Otra Persona","facebook_url":"https://facebook.com/otra.persona"}');

-- One completed and one still open reservation of buyer 1 with Renata, and one where the
-- buyer and the seller are the same account (impossible through the app; the rule must hold).
insert into public.reservations (id, buyer_id, seller_id, status, items_total_mxn, deposit_percent, deposit_mxn, deposit_clabe, expires_at, closed_at) values
  ('9b000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', 'completed', 50000, 20, 10000, '002010077777777771', now(), now()),
  ('9b000000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', 'confirmed', 50000, 20, 10000, '002010077777777771', now(), null),
  ('9b000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'completed', 50000, 20, 10000, '002010077777777771', now(), now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9a000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$ select public.rate_seller('9b000000-0000-4000-8000-000000000002', 5::smallint) $$, 'P0001', 'cannot_rate', 'Not before the purchase is completed.');
select throws_ok($$ select public.rate_seller('9b000000-0000-4000-8000-000000000001', 6::smallint) $$, 'P0001', 'invalid_rating', 'Stars go from 1 to 5.');
select throws_ok($$ select public.rate_seller('9b000000-0000-4000-8000-000000000001', 5::smallint, repeat('x', 281)) $$, 'P0001', 'invalid_comment', 'The comment is short (up to 280 characters).');
select lives_ok($$ select public.rate_seller('9b000000-0000-4000-8000-000000000001', 4::smallint, '  Todo bien, llegó rápido  ') $$, 'The buyer rates the store after a completed purchase.');
select throws_ok($$ select public.rate_seller('9b000000-0000-4000-8000-000000000001', 1::smallint) $$, 'P0001', 'cannot_rate', 'Once per reservation.');
select is((select seller_rating from public.reservations where id = '9b000000-0000-4000-8000-000000000001'), 4::smallint, 'She sees her own stars.');
select throws_ok($$ select seller_rating_comment from public.reservations where id = '9b000000-0000-4000-8000-000000000001' $$, '42501', null, 'Comments are not readable as a column.');

select set_config('request.jwt.claims', '{"sub":"9a000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$ select public.rate_seller('9b000000-0000-4000-8000-000000000001', 1::smallint) $$, 'P0001', 'cannot_rate', 'Someone else cannot rate that purchase.');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.rate_seller('9b000000-0000-4000-8000-000000000003', 5::smallint) $$, 'P0001', 'own_store', 'Nobody rates her own store.');
select is(
  (select row(stars, comment)::text from public.my_seller_ratings() where reservation_id = '9b000000-0000-4000-8000-000000000001'),
  row(4::smallint, 'Todo bien, llegó rápido')::text,
  'The seller reads her rating and its trimmed comment.'
);
select throws_ok($$ select * from public.admin_seller_ratings() $$, 'P0001', 'not_allowed', 'Only admins read every comment.');
select throws_ok($$ select public.set_seller_rating_hidden('9b000000-0000-4000-8000-000000000001', true) $$, 'P0001', 'not_allowed', 'Only admins hide a comment.');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select ok(
  (select ratings >= 1 and rating between 1 and 5 from public.seller_stats(array['10000000-0000-4000-8000-000000000001'::uuid])),
  'Anyone reads a store''s average and count.'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select lives_ok($$ select public.set_seller_rating_hidden('9b000000-0000-4000-8000-000000000001', true) $$, 'An admin hides an abusive comment.');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select row(stars, comment)::text from public.my_seller_ratings() where reservation_id = '9b000000-0000-4000-8000-000000000001'),
  row(4::smallint, null::text)::text,
  'The stars stay; the hidden comment no longer shows to the seller.'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select hidden from public.admin_seller_ratings() where reservation_id = '9b000000-0000-4000-8000-000000000001'), true, 'Admins still see it, marked hidden.');

select * from finish();
rollback;
