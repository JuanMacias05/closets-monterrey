begin;
select plan(19);

-- A shopper with five reservations from seller 1 (Renata), each in a different spot for the
-- 15-day rule.
insert into auth.users (id, aud, role, phone, raw_user_meta_data)
values ('74000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', '528100000091',
        '{"account_type":"buyer","full_name":"Compradora Comprobantes","facebook_url":"https://facebook.com/comprobantes"}');

insert into public.reservations (id, buyer_id, seller_id, status, items_total_mxn, deposit_percent, deposit_mxn, deposit_clabe, expires_at, closed_at, proof_path, proof_method, proof_reference, proof_submitted_at)
values
  -- Delivered 16 days ago: purged.
  ('75000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 'completed', 50000, 20, 10000, '002010077777777771', now() - interval '20 days', now() - interval '16 days',
   '75000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000002.jpg', 'transfer', 'MBAN01002611010001', now() - interval '19 days'),
  -- Delivered 10 days ago: kept for now.
  ('75000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 'completed', 50000, 20, 10000, '002010077777777771', now() - interval '12 days', now() - interval '10 days',
   '75000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000001.jpg', 'transfer', null, now() - interval '11 days'),
  -- Deposit confirmed long ago but never delivered: kept.
  ('75000000-0000-4000-8000-000000000003', '74000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 'confirmed', 50000, 20, 10000, '002010077777777771', now() - interval '30 days', null,
   '75000000-0000-4000-8000-000000000003/c0000000-0000-4000-8000-000000000001.jpg', 'oxxo', null, now() - interval '30 days'),
  -- Delivered 20 days ago, but the buyer has an open support request: kept until it's resolved.
  ('75000000-0000-4000-8000-000000000004', '74000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 'completed', 50000, 20, 10000, '002010077777777771', now() - interval '25 days', now() - interval '20 days',
   '75000000-0000-4000-8000-000000000004/d0000000-0000-4000-8000-000000000001.jpg', 'transfer', null, now() - interval '24 days'),
  -- Delivered 20 days ago, paid without uploading a proof: nothing to purge.
  ('75000000-0000-4000-8000-000000000005', '74000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 'completed', 50000, 20, 10000, '002010077777777771', now() - interval '25 days', now() - interval '20 days',
   null, null, null, null);

-- The first reservation also has the proof she replaced; it stays in the bucket until purged.
insert into storage.objects (bucket_id, name, owner_id)
values
  ('payment-proofs', '75000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001.jpg', '74000000-0000-4000-8000-00000000000a'),
  ('payment-proofs', '75000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000002.jpg', '74000000-0000-4000-8000-00000000000a'),
  ('payment-proofs', '75000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000001.jpg', '74000000-0000-4000-8000-00000000000a'),
  ('payment-proofs', '75000000-0000-4000-8000-000000000003/c0000000-0000-4000-8000-000000000001.jpg', '74000000-0000-4000-8000-00000000000a'),
  ('payment-proofs', '75000000-0000-4000-8000-000000000004/d0000000-0000-4000-8000-000000000001.jpg', '74000000-0000-4000-8000-00000000000a');

insert into public.support_requests (id, reservation_id, buyer_id, reason, message)
values ('76000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000004', '74000000-0000-4000-8000-00000000000a', 'other', 'La prenda llegó con una mancha.');

-- Clients can't run the purge or see its queue.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"74000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select private.purge_delivered_deposit_proofs() $$, '42501', null, 'A signed-in user cannot run the purge.');
select throws_ok($$ select * from private.deposit_proof_deletions $$, '42501', null, 'A signed-in user cannot read the deletion queue.');
reset role;

select is(private.purge_delivered_deposit_proofs(), 1, 'Only the proof delivered more than 15 days ago without an open request is purged.');

select is((select proof_path from public.reservations where id = '75000000-0000-4000-8000-000000000001'), null, 'The purged reservation no longer points at the file.');
select isnt((select proof_purged_at from public.reservations where id = '75000000-0000-4000-8000-000000000001'), null, 'The purge is recorded on the reservation.');
select is((select status::text from public.reservations where id = '75000000-0000-4000-8000-000000000001'), 'completed', 'The reservation itself stays.');
select is((select proof_reference from public.reservations where id = '75000000-0000-4000-8000-000000000001'), 'MBAN01002611010001', 'The tracking key typed by the buyer stays; only the image goes.');
select results_eq(
  $$ select object_name from private.deposit_proof_deletions order by object_name $$,
  $$ values ('75000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001.jpg'), ('75000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000002.jpg') $$,
  'Every file in the reservation''s folder is queued, including the proof she replaced.'
);

select isnt((select proof_path from public.reservations where id = '75000000-0000-4000-8000-000000000002'), null, 'A delivery from 10 days ago keeps its proof.');
select isnt((select proof_path from public.reservations where id = '75000000-0000-4000-8000-000000000003'), null, 'A reservation not delivered yet keeps its proof.');
select isnt((select proof_path from public.reservations where id = '75000000-0000-4000-8000-000000000004'), null, 'An open support request keeps the proof as evidence.');
select is((select proof_purged_at from public.reservations where id = '75000000-0000-4000-8000-000000000005'), null, 'A reservation that never had a proof is not marked as purged.');

select is(private.purge_delivered_deposit_proofs(), 0, 'A second run finds nothing new.');
select is((select count(*)::integer from private.deposit_proof_deletions), 2, 'Files still in storage stay queued for the next attempt.');

-- The admin resolves the request; the next run purges that proof too.
update public.support_requests set status = 'resolved', resolved_at = now() where id = '76000000-0000-4000-8000-000000000001';
select is(private.purge_delivered_deposit_proofs(), 1, 'Once the request is resolved, the proof is purged on the next run.');

-- The Storage API removed one file (simulated here: SQL deletes are blocked unless this flag is
-- on). The next run drops it from the queue.
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'payment-proofs' and name = '75000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001.jpg';
select is(private.purge_delivered_deposit_proofs(), 0, 'Nothing new to purge.');
select is((select count(*)::integer from private.deposit_proof_deletions), 2, 'A file already gone from storage leaves the queue; the rest stay.');

-- The buyer and the seller can read when it was purged, so the screens can say so.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select isnt((select proof_purged_at from public.reservations where id = '75000000-0000-4000-8000-000000000001'), null, 'The seller can read proof_purged_at.');
reset role;

select is((select schedule from cron.job where jobname = 'purge-delivered-deposit-proofs'), '30 9 * * *', 'The purge runs every night at 03:30 Monterrey time.');

select * from finish();
rollback;
