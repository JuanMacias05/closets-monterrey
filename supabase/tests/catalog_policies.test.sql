begin;
select plan(24);

select ok(private.is_valid_clabe('000000000000000000'), 'The CLABE checksum accepts an all-zero test CLABE.');
select ok(not private.is_valid_clabe('000000000000000001'), 'The CLABE checksum rejects a wrong check digit.');

select is(
  (select phone from auth.users where id = '10000000-0000-4000-8000-000000000004'),
  '528100000004',
  'Auth test users store phone numbers without the leading plus.'
);
select is(
  (select identity_data ->> 'phone' from auth.identities where user_id = '10000000-0000-4000-8000-000000000004' and provider = 'phone'),
  '528100000004',
  'Phone identity data uses GoTrue normalized format.'
);
select is(
  (select phone_e164 from public.seller_private_settings where seller_id = '10000000-0000-4000-8000-000000000004'),
  '+528100000004',
  'The seller phone mirror remains E.164.'
);

select ok(
  (select public from storage.buckets where id = 'product-images'),
  'The product-images bucket is public for direct image URLs.'
);
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
     and (roles && array['anon'::name, 'public'::name])),
  0,
  'No anonymous or PUBLIC SELECT policy can list objects.'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'products_slug_global_unique'),
  'Product slugs are globally unique.'
);

update public.profiles
set store_name = 'Tienda pendiente'
where id = '10000000-0000-4000-8000-000000000003';

update public.profiles
set store_name = 'Admin de prueba', status = 'approved', role = 'admin'
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
  $$ update public.profiles set slug = 'new-public-slug' where id = '10000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'Only an admin can change profile slugs',
  'A seller cannot change their store slug.'
);
select throws_ok(
  $$ update public.seller_private_settings set phone_e164 = '+520000000099' where seller_id = '10000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'The login phone must be changed through Supabase Auth verification',
  'A seller cannot change the login phone without verification.'
);
update public.products set name = 'Nombre editado', slug = 'slug-manual'
where id = '20000000-0000-4000-8000-000000000001';
select throws_ok(
  $$ update public.seller_private_settings set clabe = '000000000000000001' where seller_id = '10000000-0000-4000-8000-000000000001' $$,
  '23514',
  'new row for relation "seller_private_settings" violates check constraint "seller_clabe_format"',
  'The database rejects a CLABE with an invalid check digit.'
);
insert into storage.objects (bucket_id, name, owner, metadata)
values (
  'product-images',
  'sellers/10000000-0000-4000-8000-000000000001/avatar/rls-test.jpg',
  '10000000-0000-4000-8000-000000000001',
  '{"mimetype":"image/jpeg","size":1}'::jsonb
);
select ok(
  exists (select 1 from storage.objects where bucket_id = 'product-images' and name = 'sellers/10000000-0000-4000-8000-000000000001/avatar/rls-test.jpg'),
  'An approved seller can upload a store avatar in her own folder.'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, metadata)
     values ('product-images', 'sellers/10000000-0000-4000-8000-000000000002/avatar/rls-test.jpg', '10000000-0000-4000-8000-000000000001', '{"mimetype":"image/jpeg","size":1}'::jsonb) $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'A seller cannot upload an avatar into another seller folder.'
);
select matches(
  (select slug from public.products where id = '20000000-0000-4000-8000-000000000001'),
  '^top-satinado-marfil-[0-9a-f]{4}$',
  'Product slugs are normalized and remain stable after a name edit.'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select count(*)::integer from public.products), 13, 'An admin can read every product, including pending seller products.');
select is((select count(*)::integer from public.seller_private_settings), 5, 'An admin can read every seller private settings row.');
update public.profiles set slug = 'admin-tienda-actualizada'
where id = '10000000-0000-4000-8000-000000000004';
select is(
  (select slug from public.profiles where id = '10000000-0000-4000-8000-000000000004'),
  'admin-tienda-actualizada',
  'An admin can change a seller profile slug.'
);
update public.products
set hidden_by_admin = true
where id = '20000000-0000-4000-8000-000000000001';
select ok(
  not (select hidden_by_admin from public.products where id = '20000000-0000-4000-8000-000000000001'),
  'Admin hide and show for another seller product is deferred to phase 2c.'
);

select * from finish();
rollback;
