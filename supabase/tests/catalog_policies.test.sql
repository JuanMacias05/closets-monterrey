begin;
select plan(10);

insert into auth.users (
  id, aud, role, phone, phone_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', '+520000000003', now(),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    '{"store_name":"Tienda pendiente"}'::jsonb,
    now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', '+520000000004', now(),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    '{"store_name":"Admin de prueba"}'::jsonb,
    now(), now()
  );

update public.profiles
set store_name = 'Tienda pendiente', slug = 'tienda-pendiente'
where id = '10000000-0000-4000-8000-000000000003';

update public.profiles
set store_name = 'Admin de prueba', slug = 'admin-de-prueba', status = 'approved', role = 'admin'
where id = '10000000-0000-4000-8000-000000000004';

insert into public.products (
  id, seller_id, slug, name, category, size, condition, price_mxn,
  sale_status, publication_status
)
values (
  '20000000-0000-4000-8000-000000000013',
  '10000000-0000-4000-8000-000000000003',
  'prenda-pendiente', 'Prenda no pública', 'tops', 'M', 'new', 25000,
  'available', 'published'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.products), 12, 'The public catalog excludes a pending seller.');
select is(
  (select count(*)::integer from public.seller_private_settings),
  0,
  'Anonymous users cannot read seller private settings.'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.products), 12, 'A seller can read the public catalog but not another pending seller product.');
select is((select count(*)::integer from public.seller_private_settings), 1, 'A seller can read only their own private settings.');
select throws_ok(
  $$ update public.profiles set status = 'suspended' where id = '10000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'Only an admin can change profile role or status',
  'A seller cannot change their own status.'
);
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'Only an admin can change profile role or status',
  'A seller cannot promote themselves to admin.'
);
select throws_ok(
  $$ update public.seller_private_settings set phone_e164 = '+520000000099' where seller_id = '10000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'The login phone must be changed through Supabase Auth verification',
  'A seller cannot change the login phone without verification.'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select count(*)::integer from public.products), 13, 'An admin can read every product, including pending seller products.');
select is((select count(*)::integer from public.seller_private_settings), 4, 'An admin can read every seller private settings row.');
update public.products
set hidden_by_admin = true
where id = '20000000-0000-4000-8000-000000000001';
select ok(
  (select hidden_by_admin from public.products where id = '20000000-0000-4000-8000-000000000001'),
  'An admin can hide any product.'
);

select * from finish();
rollback;
