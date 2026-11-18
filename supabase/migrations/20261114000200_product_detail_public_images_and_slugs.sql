-- Public product photos are intentionally retrievable by URL. Storage writes remain
-- protected by owner/admin policies; there must be no public SELECT policy here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read storage objects for visible products" on storage.objects;

-- Product detail routes use a single global slug, so migrate existing rows first.
alter table public.products drop constraint if exists products_slug_per_seller;

create or replace function private.slugify_product_name(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(input, '')), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

do $$
declare
  product_row record;
  base_slug text;
  candidate_slug text;
begin
  for product_row in select id, name from public.products order by id loop
    base_slug := private.slugify_product_name(product_row.name);
    if base_slug = '' then
      base_slug := 'prenda';
    end if;

    loop
      candidate_slug := base_slug || '-' || substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 4);
      exit when not exists (
        select 1 from public.products p
        where p.slug = candidate_slug and p.id <> product_row.id
      );
    end loop;

    update public.products set slug = candidate_slug where id = product_row.id;
  end loop;
end;
$$;

alter table public.products add constraint products_slug_global_unique unique (slug);

create or replace function private.assign_product_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_slug text;
  candidate_slug text;
begin
  if tg_op = 'UPDATE' then
    -- Shared product links stay stable when the seller edits the product name.
    new.slug := old.slug;
    return new;
  end if;

  base_slug := private.slugify_product_name(new.name);
  if base_slug = '' then
    base_slug := 'prenda';
  end if;

  -- Serialize slug generation so concurrent inserts cannot claim the same slug.
  perform pg_catalog.pg_advisory_xact_lock(86170341);

  loop
    candidate_slug := base_slug || '-' || substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 4);
    exit when not exists (select 1 from public.products p where p.slug = candidate_slug);
  end loop;

  new.slug := candidate_slug;
  return new;
end;
$$;

create trigger products_assign_stable_slug
before insert or update of slug, name on public.products
for each row execute function private.assign_product_slug();

-- Persist source dimensions so Open Graph metadata can describe the actual image.
alter table public.product_images
  add column width integer,
  add column height integer,
  add constraint product_images_dimensions_positive
    check ((width is null and height is null) or (width > 0 and height > 0));
