begin;
select plan(38);

-- Seeded: Renata (seller 1, CLABE, Padre Mier), Sofía (seller 2) and the admin (4).
-- A buyer, and two garments from Renata.
insert into auth.users (id, aud, role, phone, raw_user_meta_data)
values ('82000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', '528100000083',
        '{"account_type":"buyer","full_name":"Compradora Envío","facebook_url":"https://facebook.com/compradora.envio"}');

insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn, publication_status)
values
  ('83000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pieza-envio-uno', 'Pieza envío uno', 'tops', 'M', 'new', 45000, 'published'),
  ('83000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'pieza-envio-dos', 'Pieza envío dos', 'tops', 'M', 'new', 30000, 'published');

-- Set here rather than trusting the seed: Renata delivers home from Monterrey.
update public.profiles set home_delivery_enabled = true, home_delivery_origin = 'Monterrey'
where id = '10000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------------------
-- The table and its placeholders
-- ---------------------------------------------------------------------------------------
select is((select count(*)::integer from public.delivery_zone_rates), 81, 'Every origin/destination pair of the nine known municipalities has a rate.');
select is((select fee_mxn from public.delivery_zone_rates where origin_municipality = 'Apodaca' and destination_municipality = 'Apodaca'), 6000, 'Placeholder: $60 within the same municipality.');
select is((select fee_mxn from public.delivery_zone_rates where origin_municipality = 'García' and destination_municipality = 'Juárez'), 10000, 'Placeholder: $100 to any other municipality.');
select hasnt_column('public', 'profiles', 'home_delivery_fee_mxn', 'The old fixed seller fee is gone: the rate table is the only source.');
select throws_ok(
  $$ update public.profiles set home_delivery_origin = 'Saltillo' where id = '10000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'A seller''s origin must be a known municipality.'
);

-- ---------------------------------------------------------------------------------------
-- Who reads and who writes
-- ---------------------------------------------------------------------------------------
-- The service role (maintenance scripts, e2e resets) writes through the same checks and trigger.
set local role service_role;
select lives_ok(
  $$ update public.delivery_zone_rates set fee_mxn = fee_mxn where origin_municipality = 'Guadalupe' $$,
  'The service role can still write rates.'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.delivery_zone_rates), 81, 'Visitors read the rates (the storefront shows the range).');
select throws_ok($$ update public.delivery_zone_rates set fee_mxn = 100 $$, '42501', null, 'Visitors cannot change rates.');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.delivery_zone_rates (origin_municipality, destination_municipality, fee_mxn) values ('Monterrey', 'Monterrey', 100) $$,
  '42501', null, 'A seller cannot add a rate.'
);
update public.delivery_zone_rates set fee_mxn = 100 where origin_municipality = 'Monterrey' and destination_municipality = 'Monterrey';
select is((select fee_mxn from public.delivery_zone_rates where origin_municipality = 'Monterrey' and destination_municipality = 'Monterrey'), 6000, 'A seller cannot change a rate.');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select lives_ok(
  $$ update public.delivery_zone_rates set fee_mxn = 9000 where origin_municipality = 'Monterrey' and destination_municipality = 'Apodaca' $$,
  'An admin changes a rate.'
);
select is((select fee_mxn from public.delivery_zone_rates where origin_municipality = 'Monterrey' and destination_municipality = 'Apodaca'), 9000, 'The new rate is saved.');
select is((select updated_by from public.delivery_zone_rates where origin_municipality = 'Monterrey' and destination_municipality = 'Apodaca'), '10000000-0000-4000-8000-000000000004'::uuid, 'The change records which admin made it.');
select throws_ok(
  $$ update public.delivery_zone_rates set fee_mxn = 9050 where origin_municipality = 'Monterrey' and destination_municipality = 'Apodaca' $$,
  '23514', null, 'Rates are whole pesos.'
);
select throws_ok(
  $$ update public.delivery_zone_rates set fee_mxn = 100100 where origin_municipality = 'Monterrey' and destination_municipality = 'Apodaca' $$,
  '23514', null, 'Rates stay at or under $1,000.'
);
select throws_ok(
  $$ insert into public.delivery_zone_rates (origin_municipality, destination_municipality, fee_mxn) values ('Monterrey', 'Saltillo', 10000) $$,
  '23514', null, 'Rates only exist between known municipalities.'
);
select throws_ok($$ delete from public.delivery_zone_rates $$, '42501', null, 'Not even an admin deletes rates (a missing pair would switch home delivery off).');

-- ---------------------------------------------------------------------------------------
-- Reserving with home delivery
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"82000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.cart_items (buyer_id, product_id) values ('82000000-0000-4000-8000-00000000000b', '83000000-0000-4000-8000-000000000002');

-- Renata without an origin: her switch is on, but there is nothing to price from.
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set home_delivery_origin = null where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"82000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'home_delivery', null, 'Calle Uno 123, Centro, Apodaca', null, 'Apodaca') $$,
  'P0001', 'invalid_delivery', 'Without an origin the seller does not offer home delivery.'
);

reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set home_delivery_origin = 'Monterrey' where id = '10000000-0000-4000-8000-000000000001';
-- A pair with no rate (only possible by hand; clients cannot delete rates).
delete from public.delivery_zone_rates where origin_municipality = 'Monterrey' and destination_municipality = 'García';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"82000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'home_delivery', null, 'Calle Uno 123, Centro, García', null, 'García') $$,
  'P0001', 'no_delivery_rate', 'A destination without a rate cannot be reserved with home delivery.'
);
select throws_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'home_delivery', null, 'Calle Uno 123, Centro, Apodaca') $$,
  'P0001', 'invalid_delivery', 'Home delivery needs the buyer''s municipality.'
);

-- The second garment goes to a fixed point (used below: only home delivery can be adjusted).
select lives_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'pickup_point', '60000000-0000-4000-8000-000000000001') $$,
  'The buyer reserves one garment for a fixed point.'
);

insert into public.cart_items (buyer_id, product_id) values ('82000000-0000-4000-8000-00000000000b', '83000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'home_delivery', null, 'Calle Uno 123, Centro, Apodaca', null, 'Apodaca') $$,
  'The buyer reserves the other with home delivery to Apodaca.'
);

reset role;
select set_config('request.jwt.claims', '', true);
create temporary table home_order as
  select r.id from public.reservations r
  join public.reservation_items ri on ri.reservation_id = r.id
  where ri.product_id = '83000000-0000-4000-8000-000000000001';
create temporary table point_order as
  select r.id from public.reservations r
  join public.reservation_items ri on ri.reservation_id = r.id
  where ri.product_id = '83000000-0000-4000-8000-000000000002';
grant select on home_order, point_order to authenticated;

select results_eq(
  $$ select delivery_fee_mxn, delivery_fee_estimate_mxn, delivery_origin_municipality, buyer_municipality
     from public.reservations where id = (select id from home_order) $$,
  $$ values (9000, 9000, 'Monterrey'::text, 'Apodaca'::text) $$,
  'The fee is the Monterrey → Apodaca rate, kept as both the estimate and the fee to pay.'
);
select is(
  (select deposit_mxn from public.reservations where id = (select id from home_order)),
  (select ceil(45000 * deposit_percent / 100.0 / 100.0)::integer * 100 from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'The deposit is the garments'' share only: the home-delivery fee is still paid at the door.'
);

-- ---------------------------------------------------------------------------------------
-- The seller adjusts the fee
-- ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"82000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.adjust_delivery_fee((select id from home_order), 12000) $$, 'P0001', 'not_found', 'The buyer cannot change her own shipping fee.');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.adjust_delivery_fee((select id from home_order), 12000) $$, 'P0001', 'not_found', 'Another seller cannot touch it.');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.adjust_delivery_fee((select id from home_order), -100) $$, 'P0001', 'invalid_fee', 'A negative fee is refused.');
select throws_ok($$ select public.adjust_delivery_fee((select id from home_order), 100100) $$, 'P0001', 'invalid_fee', 'A fee over $1,000 is refused.');
select throws_ok($$ select public.adjust_delivery_fee((select id from home_order), 12050) $$, 'P0001', 'invalid_fee', 'Fees are whole pesos.');
select throws_ok($$ select public.adjust_delivery_fee((select id from point_order), 5000) $$, 'P0001', 'not_home_delivery', 'Only a home-delivery fee can be adjusted.');
select lives_ok($$ select public.adjust_delivery_fee((select id from home_order), 12000) $$, 'The seller raises the fee for a far-away address.');

reset role;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select delivery_fee_mxn, delivery_fee_estimate_mxn, delivery_fee_adjusted_by, delivery_fee_adjusted_at is not null
     from public.reservations where id = (select id from home_order) $$,
  $$ values (12000, 9000, '10000000-0000-4000-8000-000000000001'::uuid, true) $$,
  'The new fee is saved next to the original estimate, with who changed it and when.'
);

-- With an hour left, an adjustment gives the buyer 12 hours to decide on the new price.
update public.reservations set expires_at = now() + interval '1 hour' where id = (select id from home_order);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.adjust_delivery_fee((select id from home_order), 13000) $$, 'The seller corrects her adjustment.');
select throws_ok($$ select public.adjust_delivery_fee((select id from home_order), 13000) $$, 'P0001', 'fee_unchanged', 'Saving the same fee again is refused.');
select is((select expires_at from public.reservations where id = (select id from home_order)), now() + interval '12 hours', 'The buyer gets at least 12 hours after a change.');

select set_config('request.jwt.claims', '{"sub":"82000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select results_eq(
  $$ select delivery_fee_mxn, delivery_fee_estimate_mxn, delivery_fee_adjusted_at is not null from public.reservations where id = (select id from home_order) $$,
  $$ values (13000, 9000, true) $$,
  'The buyer reads the estimate, the new fee and that it was adjusted.'
);
select throws_ok($$ select delivery_fee_adjusted_by from public.reservations $$, '42501', null, 'Who adjusted it stays out of client reads.');

-- Once the buyer sends her deposit proof, the price is frozen (even if it is later rejected).
reset role;
select set_config('request.jwt.claims', '', true);
update public.reservations set proof_submitted_at = now(), proof_rejected_at = now() where id = (select id from home_order);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.adjust_delivery_fee((select id from home_order), 15000) $$, 'P0001', 'deposit_sent', 'After the buyer sent her deposit, the fee cannot change.');

select * from finish();
rollback;
