begin;
select plan(26);

-- One account, several activities (20261127000100). Seeded: Renata (seller 1) and the admin (4).
insert into auth.users (id, aud, role, phone, raw_user_meta_data) values
  ('99000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', '528100000591', '{"account_type":"buyer","full_name":"Compradora Multi","facebook_url":"https://facebook.com/compradora.multi"}'),
  ('99000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', '528100000592', '{"account_type":"added_by_admin"}');

select ok((select exists (select 1 from public.admins where user_id = '10000000-0000-4000-8000-000000000004')), 'The seeded admin is in public.admins.');
select is((select count(*)::integer from public.profiles where role = 'admin'), 0, 'profiles.role no longer marks admins.');
select is(
  (select count(*)::integer from public.profiles where id = '99000000-0000-4000-8000-0000000000a1')
  + (select count(*)::integer from public.couriers where id = '99000000-0000-4000-8000-0000000000a1')
  + (select count(*)::integer from public.buyer_profiles where id = '99000000-0000-4000-8000-0000000000a1'),
  0, 'An account an admin creates starts with no activity rows.'
);

-- A buyer asks to sell and to deliver.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select is(private.is_admin(), false, 'A buyer is not an admin.');
select lives_ok($$ select public.request_activity('sell', 'Clóset Multi') $$, 'She asks to sell.');
select lives_ok($$ select public.request_activity('deliver') $$, 'And to deliver, with the name she signed up with.');
select lives_ok($$ select public.request_activity('sell', 'Otro nombre') $$, 'Asking again changes nothing.');
select is(
  (select row(store_name, status::text, added_by)::text from public.profiles where id = '99000000-0000-4000-8000-0000000000b1'),
  row('Clóset Multi', 'pending', null::uuid)::text,
  'Selling starts pending, as signed up by herself.'
);
select is((select phone_e164 from public.seller_private_settings where seller_id = '99000000-0000-4000-8000-0000000000b1'), '+528100000591', 'Her store gets her login phone.');
select is(
  (select row(full_name, status::text)::text from public.couriers where id = '99000000-0000-4000-8000-0000000000b1'),
  row('Compradora Multi', 'pending')::text,
  'Delivering starts pending, under her name.'
);
select throws_ok($$ update public.profiles set status = 'approved' where id = '99000000-0000-4000-8000-0000000000b1' $$, 'P0001', 'Only an admin can change profile role or status', 'She cannot approve herself.');
select throws_ok($$ update public.profiles set added_by = '10000000-0000-4000-8000-000000000004' where id = '99000000-0000-4000-8000-0000000000b1' $$, 'P0001', 'Only an admin can change who added an account', 'Nor claim an admin added her.');
select throws_ok($$ select public.request_activity('admin') $$, 'P0001', 'invalid_activity', 'Admin cannot be requested.');
select throws_ok($$ select public.admin_set_activities('99000000-0000-4000-8000-0000000000b1', true, true, true) $$, 'P0001', 'not_allowed', 'Only an admin grants activities.');
select throws_ok($$ select public.find_user_by_phone('+528100000591') $$, '42501', null, 'Signed-in users cannot look accounts up by phone.');

-- The admin grants activities to the account she created.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select lives_ok(
  $$ select public.admin_set_activities('99000000-0000-4000-8000-0000000000a1', true, true, true, 'Clóset Agregado', 'Persona Agregada') $$,
  'The admin grants selling, delivering and admin to a new account.'
);
select is(
  (select row(p.status::text, c.status::text, p.added_by, c.added_by, a.granted_by)::text
   from public.profiles p join public.couriers c on c.id = p.id join public.admins a on a.user_id = p.id
   where p.id = '99000000-0000-4000-8000-0000000000a1'),
  row('approved', 'approved', '10000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-4000-8000-000000000004'::uuid)::text,
  'Everything she grants starts approved, marked as added by her.'
);
select lives_ok(
  $$ select public.admin_set_activities('99000000-0000-4000-8000-0000000000b1', true, false, false) $$,
  'She approves the buyer''s store and declines her deliveries.'
);
select is(
  (select row(p.status::text, c.status::text, p.added_by)::text from public.profiles p join public.couriers c on c.id = p.id where p.id = '99000000-0000-4000-8000-0000000000b1'),
  row('approved', 'suspended', null::uuid)::text,
  'Approving keeps "signed up herself"; removing an activity suspends it.'
);
select lives_ok($$ select public.admin_set_activities('99000000-0000-4000-8000-0000000000a1', false, true, false) $$, 'She takes selling and admin away from the account she added.');
select ok(
  (select status = 'suspended' from public.profiles where id = '99000000-0000-4000-8000-0000000000a1')
  and not exists (select 1 from public.admins where user_id = '99000000-0000-4000-8000-0000000000a1'),
  'Her store is suspended and she is no longer admin.'
);
select throws_ok($$ select public.admin_set_activities('10000000-0000-4000-8000-000000000004', true, false, false) $$, 'P0001', 'own_admin', 'An admin cannot remove her own admin flag.');
select lives_ok($$ select public.admin_set_activities('10000000-0000-4000-8000-000000000004', true, true, true, null, 'Admin Recolectora') $$, 'An admin can also deliver if given that activity.');

select lives_ok($$ select public.admin_set_activities('99000000-0000-4000-8000-0000000000b1', null, true, null) $$, 'Null leaves an activity as it is: she only adds delivering back.');
select is(
  (select row(p.status::text, c.status::text)::text from public.profiles p join public.couriers c on c.id = p.id where p.id = '99000000-0000-4000-8000-0000000000b1'),
  row('approved', 'approved')::text,
  'Her store is untouched and delivering is approved.'
);

reset role;
set local role service_role;
select is(public.find_user_by_phone('+528100000592'), '99000000-0000-4000-8000-0000000000a1'::uuid, 'The app server finds an account by its phone.');

select * from finish();
rollback;
