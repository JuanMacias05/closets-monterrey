begin;
select plan(3);

-- Set a canonical store name inside this transaction; local runs may have changed it in an e2e.
update public.profiles
set store_name = 'Admin de prueba', status = 'approved', role = 'admin'
where id = '10000000-0000-4000-8000-000000000004';

insert into public.products (id, seller_id, slug, name, description, category, size, condition, price_mxn, publication_status)
values (
  '71000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000004',
  'admin-public-catalog-fixture',
  'Prenda pública de la admin',
  'Prueba de catálogo público para la admin vendedora.',
  'tops', 'M', 'new', 12000, 'published'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select store_name from public.profiles where id = '10000000-0000-4000-8000-000000000004'),
  'Admin de prueba',
  'The admin own store profile is visible in the public catalog.'
);
select is(
  (select count(*)::integer from public.products where id = '71000000-0000-4000-8000-000000000001' and publication_status = 'published'),
  1,
  'A published product owned by an admin is visible in the public catalog.'
);
select is(
  (select count(*)::integer from public.products p join public.profiles s on s.id = p.seller_id
   where p.id = '71000000-0000-4000-8000-000000000001' and s.store_name = 'Admin de prueba'),
  1,
  'The public catalog can join the admin seller store with her published product.'
);

select * from finish();
rollback;
