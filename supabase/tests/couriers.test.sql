begin;
select plan(18);

-- A new courier (sign-up path) and a buyer.
insert into auth.users (id, aud, role, phone, raw_user_meta_data) values
  ('80000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', '528100000081', '{"account_type":"courier","full_name":"Recolectora Nueva"}'),
  ('80000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', '528100000082', '{"account_type":"buyer","full_name":"Compradora C","facebook_url":"https://facebook.com/compradora.c"}');

insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn, publication_status)
values ('81000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pieza-recolectora', 'Pieza recolectora', 'tops', 'M', 'new', 30000, 'published');

select is((select status::text from public.couriers where id = '80000000-0000-4000-8000-00000000000c'), 'pending', 'A courier sign-up starts pending.');
select is((select phone_e164 from public.courier_private where courier_id = '80000000-0000-4000-8000-00000000000c'), '+528100000081', 'The courier phone is stored privately.');
select is((select count(*)::integer from public.profiles where id = '80000000-0000-4000-8000-00000000000c'), 0, 'A courier gets no seller profile.');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.couriers where id = '80000000-0000-4000-8000-00000000000c'), 0, 'A pending courier is not in the public directory.');
select is((select count(*)::integer from public.couriers where id = '10000000-0000-4000-8000-000000000006'), 1, 'A verified courier is in the public directory.');
select is((select count(*)::integer from public.courier_private), 0, 'Visitors cannot read courier phones.');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"80000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ update public.couriers set status = 'approved' where id = '80000000-0000-4000-8000-00000000000c' $$, 'P0001', 'Only an admin can approve or suspend a courier', 'A courier cannot verify herself.');

-- The buyer reserves with the verified courier (covers Monterrey, collects at Padre Mier,
-- which Renata also reaches) and adds the $45 fee to her deposit.
select set_config('request.jwt.claims', '{"sub":"80000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.cart_items (buyer_id, product_id) values ('80000000-0000-4000-8000-00000000000b', '81000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'courier', null, 'Calle Uno 123, Centro', '10000000-0000-4000-8000-000000000006', 'Apodaca', 'on_delivery') $$,
  'P0001', 'invalid_delivery', 'A courier who does not cover the buyer''s municipality cannot be chosen.'
);
select lives_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'courier', null, 'Calle Uno 123, Centro', '10000000-0000-4000-8000-000000000006', 'Monterrey', 'with_deposit') $$,
  'The buyer reserves with a courier who covers Monterrey.'
);
select is((select deposit_mxn from public.reservations), 6000 + 4500, 'With "incluida en el anticipo", the courier fee is added to the 20% deposit.');

-- Seller confirms; the courier collects, travels and delivers with the PIN.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.update_reservation((select id from public.reservations), 'confirm') $$, 'The seller confirms the deposit.');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select full_name from public.buyer_profiles), 'Compradora C', 'The assigned courier can read the buyer she delivers to.');
select lives_ok($$ select public.courier_update_reservation((select id from public.reservations), 'picked_up') $$, 'The courier marks the package collected.');
select lives_ok($$ select public.courier_update_reservation((select id from public.reservations), 'on_the_way') $$, 'The courier marks it on the way.');
select throws_ok($$ select delivery_pin from public.reservations $$, '42501', NULL, 'The courier cannot read the PIN either.');

reset role;
create temporary table handoff as select id, delivery_pin as pin from public.reservations;
grant select on handoff to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select lives_ok($$ select public.complete_reservation_with_pin((select id from handoff), (select pin from handoff)) $$, 'The courier completes the delivery with the buyer''s PIN.');

select set_config('request.jwt.claims', '{"sub":"80000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.rate_courier((select id from handoff), 5::smallint) $$, 'The buyer rates her courier.');
select throws_ok($$ select public.rate_courier((select id from handoff), 1::smallint) $$, 'P0001', 'cannot_rate', 'A delivery can only be rated once.');

select * from finish();
rollback;
