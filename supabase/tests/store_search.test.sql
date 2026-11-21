begin;
select plan(32);

-- Garments with made-up words ("quetzalita", "brumoso") so e2e leftovers in the local
-- database can't change the counts. Seller 1 (Renata) is approved, seller 3 is pending.
insert into public.products (id, seller_id, slug, name, description, category, size, condition, price_mxn, sale_status, sold_at, publication_status, hidden_by_admin)
values
  ('2a000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'busqueda-pantalon', 'Pantalón quetzalita', 'Marca Brumoso, tiro alto.', 'bottoms', 'M', 'used', 30000, 'available', null, 'published', false),
  ('2a000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'busqueda-vestido', 'Vestido quetzalita', 'Corte midi.', 'dresses', 'S', 'used', 30000, 'sold', now(), 'published', false),
  ('2a000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'busqueda-borrador', 'Blusa quetzalita borrador', '', 'tops', 'M', 'used', 30000, 'available', null, 'draft', false),
  ('2a000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'busqueda-oculta', 'Blusa quetzalita oculta', '', 'tops', 'M', 'used', 30000, 'available', null, 'published', true),
  ('2a000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'busqueda-pendiente', 'Blusa quetzalita pendiente', '', 'tops', 'M', 'used', 30000, 'available', null, 'published', false);

-- Query normalization.
select is(private.search_tokens('  Vestidos de VERANO  '), array['vestido', 'verano'], 'Tokens are lowercased, plurals dropped and filler words ignored.');
select is(private.search_tokens('PANTALÓN pantalones'), array['pantalon'], 'Accents are removed and repeated tokens collapse.');
select is(private.search_tokens('talla M 28 x'), array['m', '28'], 'Sizes and numbers survive; "talla" and stray letters do not.');
select is(private.search_tokens('!!! ¿? '), '{}'::text[], 'Punctuation alone has no tokens.');
select is(private.search_tsquery('de la'), null, 'A query of filler words matches nothing instead of everything.');
select is(private.search_tsquery('vest m'), $$'vest':* & 'm'$$::tsquery, 'Words match as prefixes, sizes as whole words.');

-- Searching, as a visitor.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select array_agg(name order by name) from public.search_products('QUETZALITA')),
  array['Pantalón quetzalita', 'Vestido quetzalita'],
  'Case-insensitive; drafts, hidden garments and pending sellers never show up.'
);
select is((select array_agg(name) from public.search_products('pantalon quetzalita')), array['Pantalón quetzalita'], 'An unaccented query finds an accented name.');
select is((select array_agg(name) from public.search_products('quetzalitas brumoso')), array['Pantalón quetzalita'], 'Every token must match; the description counts (the brand lives there).');
select is((select array_agg(name) from public.search_products('faldas quetzalita')), array['Pantalón quetzalita'], 'The category label is searchable.');
select is((select array_agg(name) from public.search_products('quetzalita s')), array['Vestido quetzalita'], 'A size token matches the size only.');
select is((select count(*)::integer from public.search_products('quetzalita xl')), 0, 'A size no garment has finds nothing.');
select is((select count(*)::integer from public.search_products('')), 0, 'An empty query returns nothing.');
select is((select count(*)::integer from public.search_products(repeat('quetzalita ', 50))), 2, 'A long query is cut down instead of failing.');

-- Nobody reads or writes the term counters directly.
select throws_ok($$ select * from public.search_terms $$, '42501', null, 'A visitor cannot read the search terms table.');
select throws_ok($$ insert into public.search_terms (term) values ('hackeo') $$, '42501', null, 'A visitor cannot insert search terms.');

-- Recording, as a visitor.
select ok(public.record_search_term('  Pantalón QUETZALITA '), 'A real search is counted.');
select ok(not public.record_search_term('ab'), 'Terms under 3 characters are ignored.');
select ok(not public.record_search_term(repeat('a', 41)), 'Terms over 40 characters are ignored.');
select ok(not public.record_search_term(repeat('vestido ', 20)), 'Pasted paragraphs are ignored.');
select ok(not public.record_search_term('uno dos tres cuatro cinco'), 'More than 4 words is ignored.');
select ok(not public.record_search_term('12345'), 'Numbers alone are ignored.');
select ok(not public.record_search_term('%%%'), 'Punctuation alone is ignored.');
select ok(not public.record_search_term(null), 'NULL is ignored.');
select ok(not public.record_search_term('pantalon quetzalita'), 'The same term counts once every few seconds.');

reset role;
select is(
  (select array_agg(term) from public.search_terms where term like '%quetzalita%'),
  array['pantalon quetzalita'],
  'The term is stored normalized, without accents or extra spaces.'
);

-- Popular terms: one that finds garments, one that finds none, one with a single search and
-- one that went quiet over a month ago.
update public.search_terms set searches = 9, last_searched_at = now() - interval '1 hour' where term = 'pantalon quetzalita';
insert into public.search_terms (term, searches, last_searched_at)
values
  ('vestido quetzalita', 4, now() - interval '2 days'),
  ('palabra inventada sin prendas', 50, now() - interval '1 hour'),
  ('brumoso', 1, now() - interval '1 hour'),
  ('quetzalita s', 80, now() - interval '31 days');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select array_agg(term order by searches desc) from public.popular_search_terms(10) where term like '%quetzalita%' or term in ('palabra inventada sin prendas', 'brumoso')),
  array['pantalon quetzalita', 'vestido quetzalita'],
  'Only terms searched twice in the last 30 days that find garments, most searched first.'
);
select ok((select count(*) from public.popular_search_terms(1)) <= 1, 'The number of terms asked for is respected.');
select ok((select count(*) from public.popular_search_terms(1000)) <= 10, 'At most 10 terms are returned.');

-- A term searched again after a quiet month starts counting over.
reset role;
update public.search_terms set last_searched_at = now() - interval '40 days' where term = 'vestido quetzalita';
set local role anon;
select ok(public.record_search_term('Vestido quetzalita'), 'A quiet term is counted again.');
reset role;
select is((select searches from public.search_terms where term = 'vestido quetzalita'), 1, 'Its counter restarts after a month without searches.');

-- New terms stop being stored once a script floods the table.
insert into public.search_terms (term, searches, last_searched_at)
select 'relleno ' || n, 1, now() - interval '10 minutes' from generate_series(1, 200) as n;
set local role anon;
select ok(not public.record_search_term('termino nuevo'), 'After 200 new terms in an hour, new terms are not stored.');

select * from finish();
rollback;
