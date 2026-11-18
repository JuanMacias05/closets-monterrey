begin;
select plan(22);

-- Two buyers created the way the sign-up form does it (account_type = buyer in metadata).
insert into auth.users (id, aud, role, phone, raw_user_meta_data)
values
  ('70000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', '528100000071',
   '{"account_type":"buyer","full_name":"Compradora A","facebook_url":"https://facebook.com/compradora.a"}'),
  ('70000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', '528100000072',
   '{"account_type":"buyer","full_name":"Compradora B","facebook_url":"https://www.facebook.com/compradora.b"}');

-- A garment from seller 1 (Renata, seeded with a CLABE).
insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn, publication_status)
values ('71000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pieza-unica-prueba', 'Pieza única', 'tops', 'M', 'new', 35050, 'published');

select is((select full_name from public.buyer_profiles where id = '70000000-0000-4000-8000-00000000000a'), 'Compradora A', 'A buyer sign-up creates a buyer profile.');
select is((select phone_e164 from public.buyer_profiles where id = '70000000-0000-4000-8000-00000000000a'), '+528100000071', 'The buyer profile mirrors the login phone in E.164.');
select is((select count(*)::integer from public.profiles where id = '70000000-0000-4000-8000-00000000000a'), 0, 'A buyer gets no public seller profile.');

-- Both buyers put the same piece in their cart.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ insert into public.cart_items (buyer_id, product_id) values ('70000000-0000-4000-8000-00000000000a', '71000000-0000-4000-8000-000000000001') $$, 'Buyer A adds the piece to her cart.');
select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ insert into public.cart_items (buyer_id, product_id) values ('70000000-0000-4000-8000-00000000000b', '71000000-0000-4000-8000-000000000001') $$, 'Buyer B adds the same piece; carts never block.');
select is((select count(*)::integer from public.cart_items), 1, 'Each buyer only sees her own cart.');
select is((select count(*)::integer from public.buyer_profiles), 1, 'A buyer cannot read other buyers.');

-- A reserves first; B loses.
select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001') $$, 'Buyer A reserves the piece.');
select is((select deposit_mxn from public.reservations limit 1), 7100, 'A 20% deposit on $350.50 rounds up to whole pesos ($71).');
select is((select count(*)::integer from public.cart_items), 0, 'Reserved pieces leave the reserving buyer''s cart.');

select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001') $$, 'P0001', 'items_unavailable', 'Buyer B cannot reserve a piece someone else holds.');
select is((select count(*)::integer from public.reservations), 0, 'Buyer B cannot see Buyer A''s reservation.');

-- The seller cannot flip a held piece by hand.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ update public.products set sale_status = 'available' where id = '71000000-0000-4000-8000-000000000001' $$, 'P0001', 'product_in_reservation', 'A held piece only changes through the reservation screens.');
select is((select full_name from public.buyer_profiles), 'Compradora A', 'The seller can read the buyer who reserved from her.');
select is(public.buyer_trust_light('70000000-0000-4000-8000-00000000000a'), 'new', 'A buyer without history shows as new.');

-- 24 hours pass without a deposit.
reset role;
update public.reservations set expires_at = now() - interval '1 minute';
select is(public.release_expired_reservations(), 1, 'An unpaid reservation past 24 h is released.');
select is((select sale_status::text from public.products where id = '71000000-0000-4000-8000-000000000001'), 'available', 'The released piece is back on sale.');

-- Buyer B now gets it, the seller confirms the deposit and delivers.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001') $$, 'Buyer B reserves the released piece from her cart.');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.update_reservation((select id from public.reservations where status = 'pending_deposit'), 'confirm') $$, 'The seller confirms the deposit.');
select lives_ok($$ select public.update_reservation((select id from public.reservations where status = 'confirmed'), 'complete') $$, 'The seller marks it delivered.');

reset role;
select is((select sale_status::text from public.products where id = '71000000-0000-4000-8000-000000000001'), 'sold', 'A delivered piece is sold.');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select results_eq(
  $$ select public.buyer_trust_light('70000000-0000-4000-8000-00000000000a') union all select public.buyer_trust_light('70000000-0000-4000-8000-00000000000b') $$,
  $$ values ('yellow'), ('green') $$,
  'Letting a reservation expire turns the light yellow; a completed purchase turns it green.'
);

select * from finish();
rollback;
