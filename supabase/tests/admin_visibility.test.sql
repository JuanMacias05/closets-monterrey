begin;
select plan(22);

insert into public.products (id, seller_id, slug, name, description, category, size, condition, price_mxn)
values ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'prenda-admin-2c', 'Prenda admin 2c', 'Descripción propia', 'tops', 'M', 'new', 10000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$ update public.products set hidden_by_admin = true where id = '20000000-0000-4000-8000-000000000001' $$,
  'P0001', 'Only an admin can hide a product', 'A seller cannot hide her own product.'
);
select ok(
  not (select hidden_by_admin from public.products where id = '20000000-0000-4000-8000-000000000001'),
  'The seller attempt leaves the product visible.'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select lives_ok(
  $$ update public.products set hidden_by_admin = true where id = '20000000-0000-4000-8000-000000000001' $$,
  'An admin can hide another seller product by changing the visibility flag.'
);
select ok(
  (select hidden_by_admin from public.products where id = '20000000-0000-4000-8000-000000000001'),
  'The foreign product is hidden.'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.products where id = '20000000-0000-4000-8000-000000000001'), 1, 'The seller can still read her hidden product in the panel.');
select throws_ok(
  $$ update public.products set hidden_by_admin = false where id = '20000000-0000-4000-8000-000000000001' $$,
  'P0001', 'Only an admin can hide a product', 'A seller cannot unhide her own product.'
);
select ok(
  (select hidden_by_admin from public.products where id = '20000000-0000-4000-8000-000000000001'),
  'The seller cannot change the hidden state.'
);
update public.products set name = 'Prenda propia oculta' where id = '20000000-0000-4000-8000-000000000001';
select is((select name from public.products where id = '20000000-0000-4000-8000-000000000001'), 'Prenda propia oculta', 'A seller can still edit her hidden product details.');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.products where id = '20000000-0000-4000-8000-000000000001'), 0, 'Anonymous catalog queries cannot see a hidden product.');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$ update public.products set price_mxn = price_mxn + 100 where id = '20000000-0000-4000-8000-000000000001' $$,
  'P0001', 'Admins may only change hidden_by_admin on another seller product', 'An admin cannot change a foreign product price.'
);
select is((select price_mxn from public.products where id = '20000000-0000-4000-8000-000000000001'), 35000, 'The foreign product price remains unchanged.');
select throws_ok(
  $$ update public.products set description = 'Cambio ajeno' where id = '20000000-0000-4000-8000-000000000001' $$,
  'P0001', 'Admins may only change hidden_by_admin on another seller product', 'An admin cannot change a foreign product description.'
);
select throws_ok(
  $$ update public.products set hidden_by_admin = false, description = 'Cambio combinado' where id = '20000000-0000-4000-8000-000000000001' $$,
  'P0001', 'Admins may only change hidden_by_admin on another seller product', 'An admin cannot combine visibility with a foreign description edit.'
);
select is((select description from public.products where id = '20000000-0000-4000-8000-000000000001'), 'Corte fluido y tirantes ajustables.', 'The foreign product description remains unchanged.');
update public.product_images set alt_text = 'Cambio ajeno' where product_id = '20000000-0000-4000-8000-000000000001';
select is((select alt_text from public.product_images where product_id = '20000000-0000-4000-8000-000000000001' and position = 0), 'Top satinado marfil, vista frontal', 'An admin cannot edit foreign product photos.');
delete from public.product_images where product_id = '20000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.product_images where product_id = '20000000-0000-4000-8000-000000000001'), 2, 'An admin cannot delete foreign product photos.');
delete from public.products where id = '20000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.products where id = '20000000-0000-4000-8000-000000000001'), 1, 'An admin cannot delete a foreign product.');
select lives_ok(
  $$ update public.products set hidden_by_admin = false where id = '20000000-0000-4000-8000-000000000001' $$,
  'An admin can show a foreign product again.'
);
select ok(
  not (select hidden_by_admin from public.products where id = '20000000-0000-4000-8000-000000000001'),
  'The foreign product is visible again.'
);
select lives_ok(
  $$ update public.products set hidden_by_admin = true where id = '70000000-0000-4000-8000-000000000001' $$,
  'An admin can also toggle visibility on her own product.'
);
select ok(
  (select hidden_by_admin from public.products where id = '70000000-0000-4000-8000-000000000001'),
  'The admin own product visibility flag was updated.'
);
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.products where id = '20000000-0000-4000-8000-000000000001'), 1, 'The foreign product returns to the public catalog after the admin shows it.');

select * from finish();
rollback;
