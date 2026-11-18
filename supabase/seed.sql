-- Datos ficticios solo para desarrollo local. Nunca ejecutar contra un remoto.
-- No usar `supabase db push --include-seed` ni `supabase db reset --linked/--remote`.
-- Los perfiles están ligados a auth.users, por eso se crean cinco identidades locales.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  phone_change,
  phone_change_token,
  reauthentication_token,
  email_change_confirm_status,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '528100000001',
    now(),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    '{"store_name":"Closet de Renata"}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '528100000002',
    now(),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    '{"store_name":"El clóset de Sofía"}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '528100000003',
    now(),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    '{"store_name":"Tienda pendiente"}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '528100000004',
    now(),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    '{"store_name":"Admin de prueba"}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '528100000005',
    now(),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    '{"store_name":"Tienda suspendida"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

-- GoTrue looks up phone-auth users through auth.identities when issuing OTPs.
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  id,
  id,
  id,
  jsonb_build_object('sub', id::text, 'phone', phone),
  'phone',
  now(),
  now(),
  now()
from auth.users
where phone in (
  '528100000001', '528100000002', '528100000003', '528100000004', '528100000005'
)
on conflict do nothing;

update public.profiles
set store_name = 'Closet de Renata', status = 'approved', role = 'seller'
where id = '10000000-0000-4000-8000-000000000001';

update public.profiles
set store_name = 'El clóset de Sofía', status = 'approved', role = 'seller'
where id = '10000000-0000-4000-8000-000000000002';

update public.profiles
set store_name = 'Tienda pendiente', status = 'pending', role = 'seller'
where id = '10000000-0000-4000-8000-000000000003';

update public.profiles
set store_name = 'Admin de prueba', status = 'approved', role = 'admin'
where id = '10000000-0000-4000-8000-000000000004';

update public.profiles
set store_name = 'Tienda suspendida', status = 'suspended', role = 'seller'
where id = '10000000-0000-4000-8000-000000000005';

insert into public.seller_private_settings (seller_id, phone_e164, whatsapp_e164, clabe)
values
  ('10000000-0000-4000-8000-000000000001', '+528100000001', '+528100000001', '000000000000000000'),
  ('10000000-0000-4000-8000-000000000002', '+528100000002', '+528100000002', '000000000000000000')
on conflict (seller_id) do update
set phone_e164 = excluded.phone_e164,
    whatsapp_e164 = excluded.whatsapp_e164,
    clabe = excluded.clabe;

insert into public.products (
  id, seller_id, slug, name, description, category, size, measurements,
  condition, price_mxn, sale_status, publication_status, reserved_at, sold_at, created_at
)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'top-satin-marfil', 'Top satinado marfil', 'Corte fluido y tirantes ajustables.', 'tops', 'S', '{"busto_cm":88,"largo_cm":52}'::jsonb, 'like_new', 35000, 'available', 'published', null, null, now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'blusa-lino-arena', 'Blusa de lino arena', 'Lino ligero con botones nacarados.', 'tops', 'M', '{"busto_cm":96,"largo_cm":60}'::jsonb, 'new', 48000, 'available', 'published', null, null, now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'jeans-rectos-azul', 'Jeans rectos azul medio', 'Denim de tiro alto, corte recto.', 'bottoms', '28', '{"cintura_cm":72,"cadera_cm":98,"largo_cm":101}'::jsonb, 'used', 42000, 'available', 'published', null, null, now() - interval '3 days'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'falda-midi-oliva', 'Falda midi oliva', 'Silueta en A con cintura elástica.', 'bottoms', 'M', '{"cintura_cm":70,"largo_cm":78}'::jsonb, 'like_new', 29000, 'reserved', 'published', now() - interval '30 minutes', null, now() - interval '4 days'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'vestido-floral', 'Vestido floral de verano', 'Estampado discreto y falda con movimiento.', 'dresses', 'S', '{"busto_cm":88,"cintura_cm":70,"largo_cm":112}'::jsonb, 'used', 65000, 'available', 'published', null, null, now() - interval '5 days'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'vestido-satin-champana', 'Vestido satinado champaña', 'Vestido midi con espalda cruzada.', 'dresses', 'M', '{"busto_cm":94,"cintura_cm":76,"largo_cm":118}'::jsonb, 'new', 72000, 'sold', 'published', null, now() - interval '1 day', now() - interval '6 days'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', 'blazer-oversize-piedra', 'Blazer oversize piedra', 'Saco ligero con hombro relajado.', 'outerwear', 'L', '{"busto_cm":108,"largo_cm":72}'::jsonb, 'like_new', 85000, 'available', 'published', null, null, now() - interval '12 hours'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002', 'chamarra-denim-clasica', 'Chamarra denim clásica', 'Básico de mezclilla con bolsillos frontales.', 'outerwear', 'M', '{"busto_cm":100,"largo_cm":58}'::jsonb, 'used', 62000, 'sold', 'published', null, now() - interval '3 hours', now() - interval '8 days'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002', 'tenis-blancos-minimal', 'Tenis blancos minimal', 'Tenis casuales en buen estado.', 'shoes', '24', '{"largo_pie_cm":24}'::jsonb, 'used', 50000, 'available', 'published', null, null, now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', 'botines-piel-negra', 'Botines de piel negra', 'Tacón bajo y cierre lateral.', 'shoes', '25', '{"largo_pie_cm":25,"tacon_cm":4}'::jsonb, 'like_new', 95000, 'reserved', 'published', now() - interval '1 hour', null, now() - interval '9 days'),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', 'bolso-bandolera-caramelo', 'Bolso bandolera caramelo', 'Bolso compacto con correa ajustable.', 'accessories', 'Única', '{"ancho_cm":24,"alto_cm":17}'::jsonb, 'like_new', 56000, 'available', 'published', null, null, now() - interval '7 hours'),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', 'bolsa-mini-marfil', 'Bolsa mini marfil', 'Bolsa estructurada para ocasiones especiales.', 'accessories', 'Única', '{"ancho_cm":19,"alto_cm":13}'::jsonb, 'new', 39000, 'sold', 'published', null, now() - interval '2 days', now() - interval '10 days')
on conflict (id) do update set
  seller_id = excluded.seller_id,
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  size = excluded.size,
  measurements = excluded.measurements,
  condition = excluded.condition,
  price_mxn = excluded.price_mxn,
  sale_status = excluded.sale_status,
  publication_status = excluded.publication_status,
  reserved_at = excluded.reserved_at,
  sold_at = excluded.sold_at,
  created_at = excluded.created_at;

-- Men's garments, so the Hombre section has something to show locally.
insert into public.products (
  id, seller_id, slug, name, description, audience, category, size, measurements,
  condition, price_mxn, sale_status, publication_status, reserved_at, sold_at, created_at
)
values
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000002', 'camisa-oxford-azul-hombre', 'Camisa Oxford azul', 'Camisa de algodón Oxford, manga larga y cuello con botones.', 'men', 'tops', 'M', '{"busto_cm":104,"largo_cm":76}'::jsonb, 'like_new', 38000, 'available', 'published', null, null, now() - interval '20 hours'),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000002', 'pantalon-chino-caqui-hombre', 'Pantalón chino caqui', 'Corte recto, gabardina ligera.', 'men', 'bottoms', 'L', '{"cintura_cm":86,"largo_cm":104}'::jsonb, 'used', 45000, 'available', 'published', null, null, now() - interval '30 hours'),
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000002', 'playera-basica-negra-hombre', 'Playera básica negra', 'Algodón pesado, cuello redondo.', 'men', 'tops', 'L', '{"busto_cm":108,"largo_cm":72}'::jsonb, 'new', 22000, 'available', 'published', null, null, now() - interval '6 hours'),
  ('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000002', 'jeans-slim-oscuro-hombre', 'Jeans slim azul oscuro', 'Corte slim, mezclilla con poco elástico.', 'men', 'bottoms', '28', '{"cintura_cm":80,"largo_cm":106}'::jsonb, 'like_new', 52000, 'available', 'published', null, null, now() - interval '2 days 4 hours'),
  ('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000002', 'chamarra-bomber-olivo-hombre', 'Chamarra bomber olivo', 'Bomber ligera con puños de punto.', 'men', 'outerwear', 'XL', '{"busto_cm":120,"largo_cm":68}'::jsonb, 'used', 68000, 'available', 'published', null, null, now() - interval '3 days 2 hours'),
  ('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000002', 'tenis-piel-blancos-hombre', 'Tenis de piel blancos', 'Piel lisa, suela de goma.', 'men', 'shoes', '28', '{"largo_pie_cm":28}'::jsonb, 'like_new', 79000, 'available', 'published', null, null, now() - interval '4 days'),
  ('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000002', 'gorra-lona-beige-hombre', 'Gorra de lona beige', 'Ajuste trasero con hebilla.', 'men', 'accessories', 'Única', '{}'::jsonb, 'new', 18000, 'available', 'published', null, null, now() - interval '5 days')
on conflict (id) do update set
  audience = excluded.audience,
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  size = excluded.size,
  measurements = excluded.measurements,
  condition = excluded.condition,
  price_mxn = excluded.price_mxn,
  sale_status = excluded.sale_status,
  publication_status = excluded.publication_status;

insert into public.product_images (product_id, source, storage_path, alt_text, position)
values
  ('20000000-0000-4000-8000-000000000013', 'local_placeholder', '/placeholders/top-front.svg', 'Camisa Oxford azul, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000013', 'local_placeholder', '/placeholders/top-detail.svg', 'Detalle de la tela Oxford', 1),
  ('20000000-0000-4000-8000-000000000014', 'local_placeholder', '/placeholders/bottom-front.svg', 'Pantalón chino caqui, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000014', 'local_placeholder', '/placeholders/bottom-detail.svg', 'Detalle de la gabardina', 1),
  ('20000000-0000-4000-8000-000000000015', 'local_placeholder', '/placeholders/top-front.svg', 'Playera básica negra, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000015', 'local_placeholder', '/placeholders/top-detail.svg', 'Detalle de la tela de la playera', 1),
  ('20000000-0000-4000-8000-000000000016', 'local_placeholder', '/placeholders/bottom-front.svg', 'Jeans slim azul oscuro, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000016', 'local_placeholder', '/placeholders/bottom-detail.svg', 'Detalle de la mezclilla oscura', 1),
  ('20000000-0000-4000-8000-000000000017', 'local_placeholder', '/placeholders/outerwear-front.svg', 'Chamarra bomber olivo, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000017', 'local_placeholder', '/placeholders/outerwear-detail.svg', 'Detalle de la forro de la bomber', 1),
  ('20000000-0000-4000-8000-000000000018', 'local_placeholder', '/placeholders/shoes-front.svg', 'Tenis de piel blancos, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000018', 'local_placeholder', '/placeholders/shoes-detail.svg', 'Detalle de la suela de los tenis', 1),
  ('20000000-0000-4000-8000-000000000019', 'local_placeholder', '/placeholders/accessory-front.svg', 'Gorra de lona beige, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000019', 'local_placeholder', '/placeholders/accessory-detail.svg', 'Detalle de la hebilla de la gorra', 1),
  ('20000000-0000-4000-8000-000000000001', 'local_placeholder', '/placeholders/top-front.svg', 'Top satinado marfil, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000001', 'local_placeholder', '/placeholders/top-detail.svg', 'Detalle del tejido satinado', 1),
  ('20000000-0000-4000-8000-000000000002', 'local_placeholder', '/placeholders/top-front.svg', 'Blusa de lino arena, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000002', 'local_placeholder', '/placeholders/top-detail.svg', 'Detalle de la blusa de lino', 1),
  ('20000000-0000-4000-8000-000000000003', 'local_placeholder', '/placeholders/bottom-front.svg', 'Jeans rectos, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000003', 'local_placeholder', '/placeholders/bottom-detail.svg', 'Detalle del denim', 1),
  ('20000000-0000-4000-8000-000000000004', 'local_placeholder', '/placeholders/bottom-front.svg', 'Falda midi, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000004', 'local_placeholder', '/placeholders/bottom-detail.svg', 'Detalle de la tela de la falda', 1),
  ('20000000-0000-4000-8000-000000000005', 'local_placeholder', '/placeholders/dress-front.svg', 'Vestido floral, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000005', 'local_placeholder', '/placeholders/dress-detail.svg', 'Detalle del vestido', 1),
  ('20000000-0000-4000-8000-000000000006', 'local_placeholder', '/placeholders/dress-front.svg', 'Vestido satinado, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000006', 'local_placeholder', '/placeholders/dress-detail.svg', 'Detalle del satín', 1),
  ('20000000-0000-4000-8000-000000000007', 'local_placeholder', '/placeholders/outerwear-front.svg', 'Blazer oversize, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000007', 'local_placeholder', '/placeholders/outerwear-detail.svg', 'Detalle del blazer', 1),
  ('20000000-0000-4000-8000-000000000008', 'local_placeholder', '/placeholders/outerwear-front.svg', 'Chamarra denim, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000008', 'local_placeholder', '/placeholders/outerwear-detail.svg', 'Detalle de la mezclilla', 1),
  ('20000000-0000-4000-8000-000000000009', 'local_placeholder', '/placeholders/shoes-front.svg', 'Tenis blancos, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000009', 'local_placeholder', '/placeholders/shoes-detail.svg', 'Detalle de los tenis', 1),
  ('20000000-0000-4000-8000-000000000010', 'local_placeholder', '/placeholders/shoes-front.svg', 'Botines negros, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000010', 'local_placeholder', '/placeholders/shoes-detail.svg', 'Detalle de los botines', 1),
  ('20000000-0000-4000-8000-000000000011', 'local_placeholder', '/placeholders/accessory-front.svg', 'Bolso bandolera, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000011', 'local_placeholder', '/placeholders/accessory-detail.svg', 'Detalle del bolso', 1),
  ('20000000-0000-4000-8000-000000000012', 'local_placeholder', '/placeholders/accessory-front.svg', 'Bolsa mini, vista frontal', 0),
  ('20000000-0000-4000-8000-000000000012', 'local_placeholder', '/placeholders/accessory-detail.svg', 'Detalle de la bolsa', 1)
on conflict (product_id, position) do update set
  source = excluded.source,
  storage_path = excluded.storage_path,
  alt_text = excluded.alt_text;

-- Delivery options: Renata reaches two metro points and delivers home for $60; Sofía offers
-- neither, so her buyers fall back to arranging delivery on WhatsApp.
insert into public.seller_delivery_points (seller_id, point_id) values
  ('10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003')
on conflict do nothing;

update public.profiles
set home_delivery_enabled = true, home_delivery_fee_mxn = 6000, home_delivery_note = 'Monterrey, San Nicolás y Guadalupe'
where id = '10000000-0000-4000-8000-000000000001';

-- A verified courier: collects at Padre Mier and delivers in Monterrey and San Nicolás for $45.
insert into auth.users (
  id, instance_id, aud, role, confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token, reauthentication_token,
  email_change_confirm_status, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  '', '', '', '', '', '', '', '', 0, '528100000006', now(),
  '{"provider":"phone","providers":["phone"]}'::jsonb,
  '{"account_type":"courier","full_name":"Lupita Recolectora"}'::jsonb, now(), now()
) on conflict (id) do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id, id, id, jsonb_build_object('sub', id::text, 'phone', phone), 'phone', now(), now(), now()
from auth.users where phone = '528100000006'
on conflict do nothing;

update public.couriers
set status = 'approved', municipalities = array['Monterrey', 'San Nicolás de los Garza'],
    days = array[2, 5]::smallint[], time_window = '5:00 a 9:00 PM', fee_mxn = 4500
where id = '10000000-0000-4000-8000-000000000006';

insert into public.courier_pickup_points (courier_id, point_id)
values ('10000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000001')
on conflict do nothing;
