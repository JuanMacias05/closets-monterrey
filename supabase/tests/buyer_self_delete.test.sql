begin;
select plan(11);

-- Three shoppers: one clean, one with an open reservation, one with a no-show.
insert into auth.users (id, aud, role, phone, raw_user_meta_data)
values
  ('72000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', '528100000081',
   '{"account_type":"buyer","full_name":"Compradora Limpia","facebook_url":"https://facebook.com/limpia"}'),
  ('72000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', '528100000082',
   '{"account_type":"buyer","full_name":"Compradora Abierta","facebook_url":"https://facebook.com/abierta"}'),
  ('72000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', '528100000083',
   '{"account_type":"buyer","full_name":"Compradora Faltista","facebook_url":"https://facebook.com/faltista"}');

-- One completed sale for the clean shopper (delivered to her home), an open one and a no-show.
insert into public.reservations (id, buyer_id, seller_id, status, items_total_mxn, deposit_percent, deposit_mxn, deposit_clabe, expires_at, delivery_method, delivery_address, delivery_pin)
values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 'completed', 50000, 20, 10000, '002010077777777771', now(), 'home_delivery', 'Calle Hidalgo 123, Centro, Monterrey', '1234'),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001', 'pending_deposit', 50000, 20, 10000, '002010077777777771', now() + interval '1 day', 'arranged', null, null),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-000000000001', 'no_show', 50000, 20, 10000, '002010077777777771', now(), 'arranged', null, null);
insert into public.favorites (buyer_id, product_id)
select '72000000-0000-4000-8000-00000000000a', id from public.products limit 1;

set local role anon;
select throws_ok($$ select public.delete_my_buyer_account() $$, '42501', null, 'A visitor without a session cannot call it.');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.delete_my_buyer_account() $$, 'P0001', 'not_a_buyer_account', 'A seller cannot delete herself here.');

select set_config('request.jwt.claims', '{"sub":"72000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.delete_my_buyer_account() $$, 'P0001', 'open_reservations', 'A shopper with an open reservation must close it first.');

select set_config('request.jwt.claims', '{"sub":"72000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.delete_my_buyer_account() $$, 'P0001', 'needs_manual_review', 'A no-show cannot wipe her record by deleting herself.');

select set_config('request.jwt.claims', '{"sub":"72000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.delete_my_buyer_account() $$, 'A clean shopper deletes her account.');

reset role;
select is((select count(*)::integer from auth.users where id = '72000000-0000-4000-8000-00000000000a'), 0, 'Her auth user is gone.');
select is((select count(*)::integer from public.buyer_profiles where id = '72000000-0000-4000-8000-00000000000a'), 0, 'Her buyer profile is gone.');
select is((select count(*)::integer from public.favorites where buyer_id = '72000000-0000-4000-8000-00000000000a'), 0, 'Her favorites are gone.');
select is((select count(*)::integer from public.reservations where id = '73000000-0000-4000-8000-000000000001'), 1, 'The seller keeps the completed sale.');
select is((select buyer_id from public.reservations where id = '73000000-0000-4000-8000-000000000001'), null, 'The kept sale no longer points at her.');
select is((select delivery_address from public.reservations where id = '73000000-0000-4000-8000-000000000001'), null, 'Her address is cleared from the kept sale.');

select * from finish();
rollback;
