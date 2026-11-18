begin;
select plan(20);

insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'orden-fotos-uno', 'Prueba orden uno', 'tops', 'M', 'new', 10000),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'orden-fotos-dos', 'Prueba orden dos', 'tops', 'M', 'new', 10000);
insert into public.product_images (id, product_id, source, storage_path, alt_text, position)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'local_placeholder', '/uno.jpg', '', 0),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'local_placeholder', '/dos.jpg', '', 1);
insert into storage.objects (bucket_id, name, owner, metadata)
values ('product-images', 'sellers/10000000-0000-4000-8000-000000000001/products/30000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001.jpg', '10000000-0000-4000-8000-000000000001', '{"mimetype":"image/jpeg","size":1}'::jsonb);

select ok(
  (select not condeferrable from pg_constraint where conname = 'product_images_product_position_unique'),
  'Image positions remain immediately unique so seed upserts keep working.'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$ select public.reorder_product_images(
    '30000000-0000-4000-8000-000000000001',
    array['40000000-0000-4000-8000-000000000002'::uuid, '40000000-0000-4000-8000-000000000001'::uuid]
  ) $$,
  'A seller can reorder all photos of her own product.'
);
select ok(private.can_upload_product_image('30000000-0000-4000-8000-000000000001'), 'The Storage ownership check finds the saved product for its seller.');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner, metadata) values ('product-images', 'sellers/10000000-0000-4000-8000-000000000001/products/30000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000004.jpg', '10000000-0000-4000-8000-000000000001', '{"mimetype":"image/jpeg","size":1}'::jsonb) $$,
  'A seller can upload into her existing product folder through the Storage policy.'
);
select is((select position from public.product_images where id = '40000000-0000-4000-8000-000000000001'), 1, 'The first photo moves to second position.');
select is((select position from public.product_images where id = '40000000-0000-4000-8000-000000000002'), 0, 'The selected main photo moves to position zero.');
select throws_ok(
  $$ select public.reorder_product_images('30000000-0000-4000-8000-000000000001', array['40000000-0000-4000-8000-000000000001'::uuid]) $$,
  'P0001', 'Image order must contain every product image exactly once', 'The RPC rejects an incomplete image order.'
);
select throws_ok(
  $$ select public.reorder_product_images('30000000-0000-4000-8000-000000000002', array[]::uuid[]) $$,
  'P0001', 'Product not found or not owned', 'A seller cannot reorder another seller photos.'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$ select public.reorder_product_images('30000000-0000-4000-8000-000000000001', array['40000000-0000-4000-8000-000000000002'::uuid, '40000000-0000-4000-8000-000000000001'::uuid]) $$,
  'P0001', 'Product not found or not owned', 'An admin cannot reorder a product she does not own.'
);
select is((select count(*)::integer from public.products where id = '30000000-0000-4000-8000-000000000002'), 1, 'An admin can read other sellers products.');
update public.products set name = 'Edición ajena' where id = '30000000-0000-4000-8000-000000000002';
select is((select name from public.products where id = '30000000-0000-4000-8000-000000000002'), 'Prueba orden dos', 'An admin cannot edit another sellers product.');
delete from public.products where id = '30000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.products where id = '30000000-0000-4000-8000-000000000002'), 1, 'An admin cannot delete another sellers product.');
update public.product_images set alt_text = 'Edición ajena' where id = '40000000-0000-4000-8000-000000000001';
select is((select alt_text from public.product_images where id = '40000000-0000-4000-8000-000000000001'), '', 'An admin cannot edit another sellers photo metadata.');
delete from public.product_images where id = '40000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.product_images where product_id = '30000000-0000-4000-8000-000000000001'), 2, 'An admin cannot delete another sellers photos.');
select throws_ok(
  $$ insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn) values ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'admin-ajena', 'Prenda ajena', 'tops', 'M', 'new', 10000) $$,
  '42501', 'new row violates row-level security policy for table "products"', 'An admin cannot create a product for another seller.'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, metadata) values ('product-images', 'sellers/10000000-0000-4000-8000-000000000001/products/30000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000002.jpg', '10000000-0000-4000-8000-000000000004', '{"mimetype":"image/jpeg","size":1}'::jsonb) $$,
  '42501', 'new row violates row-level security policy for table "objects"', 'An admin cannot upload into another sellers product folder.'
);
select lives_ok(
  $$ insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn) values ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'admin-propia', 'Prenda admin propia', 'tops', 'M', 'new', 10000) $$,
  'An admin can create her own product.'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner, metadata) values ('product-images', 'sellers/10000000-0000-4000-8000-000000000004/products/30000000-0000-4000-8000-000000000003/50000000-0000-4000-8000-000000000003.jpg', '10000000-0000-4000-8000-000000000004', '{"mimetype":"image/jpeg","size":1}'::jsonb) $$,
  'An admin can upload into her own product folder.'
);
delete from public.products where id = '30000000-0000-4000-8000-000000000003';

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
delete from public.products where id = '30000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.products where id = '30000000-0000-4000-8000-000000000001'), 0, 'The seller can delete her own product row.');
select is((select count(*)::integer from public.product_images where product_id = '30000000-0000-4000-8000-000000000001'), 0, 'Deleting a product cascades its image rows.');
reset role;

select * from finish();
rollback;
