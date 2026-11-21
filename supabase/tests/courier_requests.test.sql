begin;
select plan(60);

-- Courier requests (20261124000100): a chosen courier must accept within 2 hours; until she
-- does the buyer can't pay and the 24-hour payment clock doesn't run.
--
-- Seeded: Renata (seller 1, CLABE, reaches Padre Mier) and Lupita (courier 6: Padre Mier ->
-- Monterrey and San Nicolás, $45). Added here: a second verified courier, four buyers and a
-- garment for each. now() is fixed for the whole transaction, so deadlines compare exactly.
insert into auth.users (id, aud, role, phone, raw_user_meta_data) values
  ('91000000-0000-4000-8000-0000000000c2', 'authenticated', 'authenticated', '528100000190', '{"account_type":"courier","full_name":"Recolectora Dos"}'),
  ('91000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', '528100000191', '{"account_type":"buyer","full_name":"Compradora Uno","facebook_url":"https://facebook.com/compradora.uno"}'),
  ('91000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', '528100000192', '{"account_type":"buyer","full_name":"Compradora Dos","facebook_url":"https://facebook.com/compradora.dos"}'),
  ('91000000-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', '528100000193', '{"account_type":"buyer","full_name":"Compradora Tres","facebook_url":"https://facebook.com/compradora.tres"}'),
  ('91000000-0000-4000-8000-0000000000b4', 'authenticated', 'authenticated', '528100000194', '{"account_type":"buyer","full_name":"Compradora Cuatro","facebook_url":"https://facebook.com/compradora.cuatro"}');

update public.couriers set status = 'approved', municipalities = array['Monterrey'], fee_mxn = 5000
where id = '91000000-0000-4000-8000-0000000000c2';
insert into public.courier_pickup_points (courier_id, point_id)
values ('91000000-0000-4000-8000-0000000000c2', '60000000-0000-4000-8000-000000000001');

insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn, publication_status) values
  ('92000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pieza-solicitud-uno', 'Pieza solicitud uno', 'tops', 'M', 'new', 30000, 'published'),
  ('92000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'pieza-solicitud-dos', 'Pieza solicitud dos', 'tops', 'M', 'new', 40000, 'published'),
  ('92000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'pieza-solicitud-tres', 'Pieza solicitud tres', 'tops', 'M', 'new', 50000, 'published'),
  ('92000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'pieza-solicitud-cuatro', 'Pieza solicitud cuatro', 'tops', 'M', 'new', 20000, 'published');

insert into public.cart_items (buyer_id, product_id) values
  ('91000000-0000-4000-8000-0000000000b1', '92000000-0000-4000-8000-000000000001'),
  ('91000000-0000-4000-8000-0000000000b2', '92000000-0000-4000-8000-000000000002'),
  ('91000000-0000-4000-8000-0000000000b3', '92000000-0000-4000-8000-000000000003'),
  ('91000000-0000-4000-8000-0000000000b4', '92000000-0000-4000-8000-000000000004');

-- Ids the assertions below need, filled in as reservations are made.
create temporary table ids (name text primary key, id uuid);
grant select on ids to authenticated;

-- ---------------------------------------------------------------------------------------
-- 1. Requested -> accepted (buyer 1, Lupita, fee inside the deposit)
-- ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select lives_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'courier', null, 'Calle Uno 123, Centro', '10000000-0000-4000-8000-000000000006', 'Monterrey', 'with_deposit') $$,
  'Choosing a courier reserves the garments and sends her a request.'
);

reset role;
insert into ids select 'r1', id from public.reservations where buyer_id = '91000000-0000-4000-8000-0000000000b1';
insert into ids select 'q1', id from public.courier_requests where reservation_id = (select id from ids where name = 'r1');

select is((select status::text from public.courier_requests where id = (select id from ids where name = 'q1')), 'requested', 'The request starts waiting.');
select is((select expires_at from public.courier_requests where id = (select id from ids where name = 'q1')), now() + interval '2 hours', 'The courier has 2 hours to answer.');
select is(
  (select expires_at from public.reservations where id = (select id from ids where name = 'r1')),
  now() + interval '2 hours' + interval '12 hours',
  'The 24-hour payment clock is not running yet: the hold lasts the request plus the 12 hours to choose again.'
);
select ok(
  (select courier_accepted_at is null and courier_whatsapp is null and courier_id = '10000000-0000-4000-8000-000000000006' from public.reservations where id = (select id from ids where name = 'r1')),
  'The courier is on the reservation but has not accepted, and her phone is not shared yet.'
);
select is((select deposit_mxn from public.reservations where id = (select id from ids where name = 'r1')), 6000 + 4500, 'The deposit quote already carries her fee (20% of $300 + $45).');

-- Payment is blocked while she hasn't answered.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.submit_deposit_proof((select id from ids where name = 'r1'), (select id from ids where name = 'r1') || '/00000000-0000-4000-8000-000000000000.jpg', 'transfer') $$,
  'P0001', 'courier_pending', 'The buyer cannot send a deposit proof before the courier accepts.'
);
select is(
  private.can_upload_deposit_proof((select id from ids where name = 'r1') || '/00000000-0000-4000-8000-000000000000.jpg'),
  false, 'Nor upload the proof photo.'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$ select public.update_reservation((select id from ids where name = 'r1'), 'confirm') $$,
  'P0001', 'courier_not_accepted', 'The seller cannot confirm a deposit before the courier accepts.'
);
select is((select status::text from public.courier_requests where id = (select id from ids where name = 'q1')), 'requested', 'The seller sees the request on her reservation.');

-- What the courier sees before deciding.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select count(*)::integer from public.reservations where id = (select id from ids where name = 'r1')), 0, 'Before accepting, the courier cannot read the reservation (no address).');
select is((select count(*)::integer from public.buyer_profiles where id = '91000000-0000-4000-8000-0000000000b1'), 0, 'Nor the buyer''s profile.');
select is(
  (select row(store_name, buyer_municipality, pickup_points, garments, fee_mxn, fee_payment::text)::text from public.courier_request_inbox() where request_id = (select id from ids where name = 'q1')),
  row('Closet de Renata', 'Monterrey', array['Estación Padre Mier'], array['Pieza solicitud uno'], 4500, 'with_deposit')::text,
  'Her inbox shows the store, where she collects, the municipality, the garments and her fee.'
);
select is((select count(*)::integer from public.courier_requests where id = (select id from ids where name = 'q1')), 1, 'She reads her own request.');

-- Nobody else answers for her.
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$ select public.accept_courier_request((select id from ids where name = 'q1')) $$, 'P0001', 'not_found', 'Another courier cannot accept it.');
select is((select count(*)::integer from public.courier_requests where id = (select id from ids where name = 'q1')), 0, 'Another courier cannot even see it.');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$ select public.accept_courier_request((select id from ids where name = 'q1')) $$, 'P0001', 'not_found', 'The buyer cannot accept it.');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.reject_courier_request((select id from ids where name = 'q1')) $$, 'P0001', 'not_found', 'The seller cannot reject it.');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select lives_ok($$ select public.accept_courier_request((select id from ids where name = 'q1')) $$, 'The courier accepts.');
select throws_ok($$ select public.accept_courier_request((select id from ids where name = 'q1')) $$, 'P0001', 'request_closed', 'A request is answered once.');
select is((select full_name from public.buyer_profiles where id = '91000000-0000-4000-8000-0000000000b1'), 'Compradora Uno', 'Once she accepts, she reads the buyer she delivers to.');
select is((select delivery_address from public.reservations where id = (select id from ids where name = 'r1')), 'Calle Uno 123, Centro', 'And the delivery address.');

reset role;
select is((select status::text from public.courier_requests where id = (select id from ids where name = 'q1')), 'accepted', 'The request is accepted.');
select ok(
  (select courier_accepted_at = now() and courier_whatsapp = '+528100000006' from public.reservations where id = (select id from ids where name = 'r1')),
  'The reservation records the acceptance and now shares the courier''s phone.'
);
select is((select expires_at from public.reservations where id = (select id from ids where name = 'r1')), now() + interval '24 hours', 'The 24-hour payment clock starts when she accepts.');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.submit_deposit_proof((select id from ids where name = 'r1'), (select id from ids where name = 'r1') || '/00000000-0000-4000-8000-000000000000.jpg', 'transfer') $$,
  'P0001', 'invalid_proof', 'After she accepts, paying is open (this one only fails because no photo was uploaded).'
);
select throws_ok(
  $$ select public.change_reservation_delivery((select id from ids where name = 'r1'), 'pickup_point', '60000000-0000-4000-8000-000000000001') $$,
  'P0001', 'delivery_locked', 'An accepted courier delivery cannot be switched by the buyer.'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.update_reservation((select id from ids where name = 'r1'), 'confirm') $$, 'The seller can confirm the deposit once the courier accepted.');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select lives_ok($$ select public.courier_update_reservation((select id from ids where name = 'r1'), 'picked_up') $$, 'The accepted courier moves the delivery forward.');

-- ---------------------------------------------------------------------------------------
-- 2. Rejected -> another courier -> withdrawn by switching to a fixed point (buyer 2)
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select lives_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'courier', null, 'Calle Dos 456, Centro', '10000000-0000-4000-8000-000000000006', 'Monterrey', 'on_delivery') $$,
  'Buyer 2 asks Lupita.'
);
reset role;
insert into ids select 'r2', id from public.reservations where buyer_id = '91000000-0000-4000-8000-0000000000b2';
insert into ids select 'q2', id from public.courier_requests where reservation_id = (select id from ids where name = 'r2');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select throws_ok(
  $$ select public.reject_courier_request((select id from ids where name = 'q2'), repeat('x', 161)) $$,
  'P0001', 'invalid_reason', 'A rejection reason is short (up to 160 characters).'
);
select lives_ok($$ select public.reject_courier_request((select id from ids where name = 'q2'), '  No paso por ahí ese día  ') $$, 'The courier rejects, with a reason.');
select is(
  (select buyer_municipality from public.courier_request_inbox() where request_id = (select id from ids where name = 'q2')),
  null, 'Once answered, her history keeps the outcome but no longer the buyer''s municipality.'
);

reset role;
select is(
  (select row(status::text, rejection_reason, resolved_at = now())::text from public.courier_requests where id = (select id from ids where name = 'q2')),
  row('rejected', 'No paso por ahí ese día', true)::text,
  'The request is rejected with the trimmed reason.'
);
select ok(
  (select status = 'pending_deposit' and courier_id is null and expires_at = now() + interval '12 hours' from public.reservations where id = (select id from ids where name = 'r2')),
  'The garments stay held; the courier is off and the buyer has 12 hours to choose again.'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select is((select rejection_reason from public.courier_requests where id = (select id from ids where name = 'q2')), 'No paso por ahí ese día', 'The buyer reads why.');
select throws_ok(
  $$ select public.submit_deposit_proof((select id from ids where name = 'r2'), (select id from ids where name = 'r2') || '/00000000-0000-4000-8000-000000000000.jpg', 'transfer') $$,
  'P0001', 'courier_pending', 'Without a courier who said yes, she still cannot pay.'
);
select throws_ok(
  $$ select public.change_reservation_delivery((select id from ids where name = 'r2'), 'courier', null, 'Calle Dos 456, Centro', '10000000-0000-4000-8000-000000000006', 'Monterrey', 'on_delivery') $$,
  'P0001', 'courier_declined', 'A courier who said no is not asked again for the same reservation.'
);
select lives_ok(
  $$ select public.change_reservation_delivery((select id from ids where name = 'r2'), 'courier', null, 'Calle Dos 456, Centro', '91000000-0000-4000-8000-0000000000c2', 'Monterrey', 'with_deposit') $$,
  'She asks another courier instead.'
);
reset role;
insert into ids select 'q2b', id from public.courier_requests where reservation_id = (select id from ids where name = 'r2') and status = 'requested';
select ok(
  (select courier_id = '91000000-0000-4000-8000-0000000000c2' and deposit_mxn = 8000 + 5000 and expires_at = now() + interval '14 hours' from public.reservations where id = (select id from ids where name = 'r2')),
  'The new request has its own 2 hours, and the deposit follows the new courier''s fee (20% of $400 + $50).'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select lives_ok(
  $$ select public.change_reservation_delivery((select id from ids where name = 'r2'), 'pickup_point', '60000000-0000-4000-8000-000000000003') $$,
  'While the second courier hasn''t answered, she switches to a fixed point.'
);
reset role;
select is((select status::text from public.courier_requests where id = (select id from ids where name = 'q2b')), 'withdrawn', 'The waiting request is withdrawn.');
select ok(
  (select delivery_method = 'pickup_point' and courier_id is null and courier_fee_payment is null and delivery_fee_mxn = 0
          and deposit_mxn = 8000 and expires_at = now() + interval '24 hours'
   from public.reservations where id = (select id from ids where name = 'r2')),
  'A fixed point proceeds normally: garments-only deposit and 24 hours to pay from now.'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$ select public.accept_courier_request((select id from ids where name = 'q2b')) $$, 'P0001', 'request_closed', 'A withdrawn request can no longer be accepted.');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select throws_ok(
  $$ select public.submit_deposit_proof((select id from ids where name = 'r2'), (select id from ids where name = 'r2') || '/00000000-0000-4000-8000-000000000000.jpg', 'transfer') $$,
  'P0001', 'invalid_proof', 'With a fixed point she can pay right away.'
);
select throws_ok(
  $$ select public.change_reservation_delivery((select id from ids where name = 'r2'), 'pickup_point', '60000000-0000-4000-8000-000000000001') $$,
  'P0001', 'delivery_locked', 'Only a courier delivery without a yes can be switched.'
);

-- ---------------------------------------------------------------------------------------
-- 3. Expired after 2 hours, re-asked, capped at 3 requests, then released (buyer 3)
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
select lives_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'courier', null, 'Calle Tres 789, Centro', '91000000-0000-4000-8000-0000000000c2', 'Monterrey', 'on_delivery') $$,
  'Buyer 3 asks the second courier.'
);
reset role;
insert into ids select 'r3', id from public.reservations where buyer_id = '91000000-0000-4000-8000-0000000000b3';
insert into ids select 'q3', id from public.courier_requests where reservation_id = (select id from ids where name = 'r3');

-- Defense in depth: even with its own deadline past, a reservation waiting for a courier is
-- not released on the payment clock.
update public.reservations set expires_at = now() - interval '1 minute' where id = (select id from ids where name = 'r3');
select public.release_expired_reservations();
select is((select status::text from public.reservations where id = (select id from ids where name = 'r3')), 'pending_deposit', 'A reservation waiting for its courier does not expire on the payment clock.');

-- Two hours pass without an answer.
update public.courier_requests set requested_at = now() - interval '2 hours 1 minute', expires_at = now() - interval '1 minute'
where id = (select id from ids where name = 'q3');
select public.release_expired_reservations();
select is(
  (select row(status::text, resolved_at = now() - interval '1 minute')::text from public.courier_requests where id = (select id from ids where name = 'q3')),
  row('expired', true)::text,
  'With no answer in 2 hours the request expires, lazily, dated when its time ran out.'
);
select ok(
  (select status = 'pending_deposit' and courier_id is null and expires_at = now() - interval '1 minute' + interval '12 hours' from public.reservations where id = (select id from ids where name = 'r3')),
  'The garments stay held and the 12 hours to choose again count from when the request ran out.'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$ select public.accept_courier_request((select id from ids where name = 'q3')) $$, 'P0001', 'request_closed', 'A late yes does not count.');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
select lives_ok(
  $$ select public.change_reservation_delivery((select id from ids where name = 'r3'), 'courier', null, 'Calle Tres 789, Centro', '91000000-0000-4000-8000-0000000000c2', 'Monterrey', 'on_delivery') $$,
  'A courier who only missed the 2 hours can be asked again (request 2).'
);
select lives_ok(
  $$ select public.change_reservation_delivery((select id from ids where name = 'r3'), 'courier', null, 'Calle Tres 789, Centro', '10000000-0000-4000-8000-000000000006', 'Monterrey', 'on_delivery') $$,
  'She changes to Lupita while the second request waits (request 3).'
);
select throws_ok(
  $$ select public.change_reservation_delivery((select id from ids where name = 'r3'), 'courier', null, 'Calle Tres 789, Centro', '91000000-0000-4000-8000-0000000000c2', 'Monterrey', 'on_delivery') $$,
  'P0001', 'too_many_courier_requests', 'A reservation sends at most 3 courier requests.'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select lives_ok(
  $$ select public.reject_courier_request((select id from public.courier_requests where status = 'requested' and courier_id = '10000000-0000-4000-8000-000000000006' and requested_at = now() order by requested_at desc limit 1)) $$,
  'Lupita rejects without a reason.'
);

-- The buyer lets the 12 hours to choose again pass.
reset role;
update public.reservations set expires_at = now() - interval '1 minute' where id = (select id from ids where name = 'r3');
select public.release_expired_reservations();
select is((select status::text from public.reservations where id = (select id from ids where name = 'r3')), 'expired', 'Without a new choice in time, the reservation expires like any unpaid one.');
select is((select sale_status::text from public.products where id = '92000000-0000-4000-8000-000000000003'), 'available', 'Its garment is back on sale.');

-- ---------------------------------------------------------------------------------------
-- 4. Cancelling while a request waits withdraws it (buyer 4)
-- ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000b4","role":"authenticated"}', true);
select lives_ok(
  $$ select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'courier', null, 'Calle Cuatro 10, Centro', '91000000-0000-4000-8000-0000000000c2', 'Monterrey', 'on_delivery') $$,
  'Buyer 4 asks the second courier.'
);
select lives_ok(
  $$ select public.update_reservation((select id from public.reservations where buyer_id = '91000000-0000-4000-8000-0000000000b4'), 'cancel') $$,
  'And cancels before she answers.'
);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.courier_request_inbox() where status = 'requested'),
  0, 'The request leaves the courier''s pending list (it is withdrawn).'
);

select * from finish();
rollback;
