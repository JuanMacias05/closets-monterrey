-- Store search: the "Buscar" panel in the header, its results page (/?q=) and the
-- "Lo más buscado" chips.
--
-- Matching. A garment's searchable text is its name, description, size and the Spanish label
-- of its category ("Pantalones y faldas"), lowercased and without accents, as a 'simple'
-- tsvector (no language stemming: Spanish stemming mangles garment words and brand names).
-- A query is split into tokens the same way; every token must match (AND):
--   * sizes (xs, s, m, l, xl, xxl) and numbers match a whole word, so "m" doesn't match
--     "midi" and "28" doesn't match "280";
--   * any other token matches as a word prefix, so "vest" finds "vestido" as you type;
--   * a trailing plural is dropped first ("vestidos" -> "vestido", "pantalones" -> "pantalon")
--     so the plural finds the singular;
--   * filler words ("de", "con", "talla"...) are ignored: as required tokens they'd turn
--     "vestido de verano" into zero results.
-- src/features/search/search-query.ts mirrors these rules for the demo catalog the e2e suite
-- runs on; change both together.
--
-- There is no brand column on products: sellers write the brand in the name or description,
-- which is what the search covers.
--
-- Popular terms. public.search_terms keeps one row per normalized term with a counter and the
-- last time it was searched: no user ids, no sessions. Nobody reads or writes it directly;
-- anon and authenticated only reach it through the two RPCs below.

create extension if not exists unaccent with schema extensions;

-- unaccent() is only STABLE (it reads its dictionary), so it can't appear in an index
-- expression. Pinning the dictionary makes the result depend on the input alone, which is the
-- documented way to index unaccented text.
create function private.search_unaccent(value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value)
$$;

-- Lowercase, no accents, only letters and digits separated by single spaces.
create function private.search_normalize(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(lower(private.search_unaccent(coalesce(value, ''))), '[^a-z0-9]+', ' ', 'g'))
$$;

-- The query tokens, in the order typed, without repeats, at most 6 of 30 characters each.
create function private.search_tokens(query text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(token order by first_position), '{}'::text[])
  from (
    select token, min(position) as first_position
    from (
      select
        left(
          case
            when length(word) > 5 and word ~ '[^aeiou]es$' then left(word, -2)
            when length(word) > 4 and word ~ 's$' then left(word, -1)
            else word
          end,
          30
        ) as token,
        position
      from unnest(string_to_array(private.search_normalize(left(query, 200)), ' ')) with ordinality as words (word, position)
      where word <> ''
        and word <> all (array['de', 'del', 'la', 'las', 'el', 'los', 'y', 'o', 'a', 'al', 'en', 'con', 'sin', 'para', 'por', 'un', 'una', 'talla'])
        -- One- and two-letter words only mean something as a size or a number.
        and (length(word) > 2 or word ~ '^[0-9]+$' or word = any (array['xs', 's', 'm', 'l', 'xl']))
    ) tokens
    group by token
    order by min(position)
    limit 6
  ) distinct_tokens
$$;

-- NULL when the query has nothing searchable, so `document @@ NULL` matches no row.
create function private.search_tsquery(query text)
returns tsquery
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when cardinality(tokens) = 0 then null else
    to_tsquery('pg_catalog.simple', array_to_string(array(
      select case
        when token ~ '^[0-9]+$' or token = any (array['xs', 's', 'm', 'l', 'xl', 'xxl']) then quote_literal(token)
        else quote_literal(token) || ':*'
      end
      from unnest(tokens) as token
    ), ' & '))
  end
  from (select private.search_tokens(query) as tokens) t
$$;

create function private.product_search_document(name text, description text, size text, category text)
returns tsvector
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    setweight(to_tsvector('pg_catalog.simple', private.search_normalize(name)), 'A')
    || setweight(to_tsvector('pg_catalog.simple', private.search_normalize(
      size || ' ' || case category
        when 'tops' then 'Blusas y tops'
        when 'bottoms' then 'Pantalones y faldas'
        when 'dresses' then 'Vestidos'
        when 'outerwear' then 'Chamarras y sacos'
        when 'shoes' then 'Calzado'
        when 'accessories' then 'Accesorios'
        else category
      end
    )), 'B')
    || setweight(to_tsvector('pg_catalog.simple', private.search_normalize(description)), 'C')
$$;

-- Only what the public catalog can show is ever searched, so the index skips drafts and
-- hidden garments.
create index products_search_idx
  on public.products
  using gin (private.product_search_document(name, description, size, category))
  where publication_status = 'published' and not hidden_by_admin;

-- The helpers above keep PostgreSQL's default EXECUTE for everyone, on purpose: Postgres runs
-- index expressions with the privileges of whoever writes the row, so every role that inserts
-- or updates products (sellers, admins, service_role in scripts) must be able to call them,
-- and search_products runs them as the caller. They are pure text functions and live in the
-- private schema, which the API doesn't expose.

-- Returns product rows so PostgREST can embed the seller and images exactly as the catalog
-- query does, and the app applies the catalog's filters, order and paging on top.
-- SECURITY INVOKER keeps the products RLS in force; the visibility conditions are repeated
-- anyway because RLS also lets a seller (and an admin) see drafts and hidden garments, which
-- the store search must never return.
create function public.search_products(search text)
returns setof public.products
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.products p
  where p.publication_status = 'published'::public.product_publication_status
    and not p.hidden_by_admin
    and exists (
      select 1 from public.profiles s
      where s.id = p.seller_id and s.status = 'approved'::public.seller_status
    )
    and private.product_search_document(p.name, p.description, p.size, p.category) @@ private.search_tsquery(search)
$$;

create table public.search_terms (
  term text primary key,
  searches integer not null default 1,
  last_searched_at timestamptz not null default now(),
  constraint search_terms_term_format check (term ~ '^[a-z0-9]+( [a-z0-9]+)*$' and length(term) between 3 and 40),
  constraint search_terms_searches_positive check (searches > 0)
);

create index search_terms_recent_idx on public.search_terms (last_searched_at desc);

alter table public.search_terms enable row level security;
revoke all on table public.search_terms from public, anon, authenticated;

-- Counts one submitted search. Returns whether it was counted.
--
-- Anyone can call it, so it assumes junk: terms under 3 or over 40 characters (after
-- normalizing), with more than 4 words, without a letter, or arriving with over 100 raw
-- characters are ignored. The same term counts at most once every 3 seconds, and once 200
-- brand-new terms have appeared in the last hour, new ones wait; that bounds how fast a script
-- can grow the table. Terms nobody searched for 90 days are dropped.
-- What a script can still do is inflate a real word, which is why popular_search_terms only
-- shows terms that find garments.
create function public.record_search_term(search_term text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized text;
begin
  if search_term is null or length(search_term) > 100 then
    return false;
  end if;

  normalized := private.search_normalize(search_term);
  if length(normalized) < 3 or length(normalized) > 40
     or cardinality(string_to_array(normalized, ' ')) > 4
     or normalized !~ '[a-z]' then
    return false;
  end if;

  if not exists (select 1 from public.search_terms t where t.term = normalized) then
    if (select count(*) from public.search_terms t
        where t.searches = 1 and t.last_searched_at > now() - interval '1 hour') >= 200 then
      return false;
    end if;
    delete from public.search_terms t where t.last_searched_at < now() - interval '90 days';
  elsif exists (select 1 from public.search_terms t
                where t.term = normalized and t.last_searched_at > now() - interval '3 seconds') then
    return false;
  end if;

  -- A term that went quiet for a month starts over, so the counter tracks recent interest
  -- rather than a lifetime total.
  insert into public.search_terms as t (term) values (normalized)
  on conflict (term) do update
    set searches = case
          when t.last_searched_at < now() - interval '30 days' then 1
          else least(t.searches, 2000000000) + 1
        end,
        last_searched_at = now();
  return true;
end;
$$;

-- The most searched terms of the last 30 days, at most 10. A term needs two searches and has
-- to find at least one garment the public can see: a chip that leads to "no results" is
-- useless, and it keeps a script from putting arbitrary words on the store's front page.
create function public.popular_search_terms(max_terms integer default 5)
returns table (term text, searches integer)
language sql
stable
security definer
set search_path = ''
as $$
  select candidates.term, candidates.searches
  from (
    select t.term, t.searches, t.last_searched_at
    from public.search_terms t
    where t.last_searched_at >= now() - interval '30 days'
      and t.searches >= 2
    order by t.searches desc, t.last_searched_at desc
    limit 50
  ) candidates
  where exists (
    select 1
    from public.products p
    join public.profiles s on s.id = p.seller_id and s.status = 'approved'::public.seller_status
    where p.publication_status = 'published'::public.product_publication_status
      and not p.hidden_by_admin
      and private.product_search_document(p.name, p.description, p.size, p.category) @@ private.search_tsquery(candidates.term)
  )
  order by candidates.searches desc, candidates.last_searched_at desc, candidates.term
  limit least(greatest(coalesce(max_terms, 5), 1), 10)
$$;

revoke all on function public.search_products(text) from public;
revoke all on function public.record_search_term(text) from public;
revoke all on function public.popular_search_terms(integer) from public;
grant execute on function public.search_products(text) to anon, authenticated;
grant execute on function public.record_search_term(text) to anon, authenticated;
grant execute on function public.popular_search_terms(integer) to anon, authenticated;
