create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create type public.seller_status as enum ('pending', 'approved', 'suspended');
create type public.user_role as enum ('admin', 'seller');
create type public.product_condition as enum ('new', 'like_new', 'used');
create type public.product_sale_status as enum ('available', 'reserved', 'sold');
create type public.product_publication_status as enum ('draft', 'published');
create type public.product_image_source as enum ('local_placeholder', 'storage');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  store_name text not null default 'Mi closet',
  slug text not null unique,
  avatar_path text,
  status public.seller_status not null default 'pending',
  role public.user_role not null default 'seller',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_store_name_not_blank check (length(trim(store_name)) > 0),
  constraint profiles_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.seller_private_settings (
  seller_id uuid primary key references public.profiles (id) on delete cascade,
  phone_e164 text unique,
  whatsapp_e164 text,
  clabe text,
  updated_at timestamptz not null default now(),
  constraint seller_phone_e164_format check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint seller_whatsapp_e164_format check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint seller_clabe_format check (clabe is null or clabe ~ '^[0-9]{18}$')
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  category text not null,
  size text not null,
  measurements jsonb not null default '{}'::jsonb,
  condition public.product_condition not null,
  price_mxn integer not null,
  sale_status public.product_sale_status not null default 'available',
  publication_status public.product_publication_status not null default 'draft',
  hidden_by_admin boolean not null default false,
  reserved_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_per_seller unique (seller_id, slug),
  constraint products_name_not_blank check (length(trim(name)) > 0),
  constraint products_category_allowed check (category in ('tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories')),
  constraint products_size_not_blank check (length(trim(size)) > 0),
  constraint products_price_nonnegative check (price_mxn >= 0),
  constraint products_reserved_timestamp check ((sale_status = 'reserved') = (reserved_at is not null)),
  constraint products_sold_timestamp check ((sale_status = 'sold') = (sold_at is not null))
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  source public.product_image_source not null,
  storage_path text not null,
  alt_text text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_images_position_nonnegative check (position >= 0),
  constraint product_images_product_position_unique unique (product_id, position)
);

create index products_catalog_status_created_idx
  on public.products (publication_status, sale_status, created_at desc);
create index products_seller_id_idx on public.products (seller_id);
create index products_category_idx on public.products (category);
create index products_size_idx on public.products (size);
create index products_condition_idx on public.products (condition);
create index products_price_mxn_idx on public.products (price_mxn);
create index product_images_product_position_idx on public.product_images (product_id, position);

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'::public.user_role
      and p.status = 'approved'::public.seller_status
  );
$$;

grant execute on function private.is_admin() to anon, authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger seller_private_settings_set_updated_at
before update on public.seller_private_settings
for each row execute function private.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

create function private.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only an admin can change profile role or status';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_admin_fields
before update on public.profiles
for each row execute function private.guard_profile_changes();

create function private.guard_login_phone_mirror()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1
     and (select auth.uid()) is not null
     and not private.is_admin()
     and new.phone_e164 is distinct from old.phone_e164 then
    raise exception 'The login phone must be changed through Supabase Auth verification';
  end if;
  return new;
end;
$$;

create trigger seller_private_settings_guard_login_phone
before update on public.seller_private_settings
for each row execute function private.guard_login_phone_mirror();

create function private.guard_product_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    if new.hidden_by_admin is distinct from old.hidden_by_admin then
      raise exception 'Only an admin can hide a product';
    end if;

    if new.seller_id is distinct from old.seller_id then
      raise exception 'A product owner cannot be changed';
    end if;

    if new.publication_status = 'published'::public.product_publication_status
       and not exists (
         select 1 from public.profiles p
         where p.id = new.seller_id and p.status = 'approved'::public.seller_status
       ) then
      raise exception 'Only approved sellers can publish products';
    end if;
  end if;
  return new;
end;
$$;

create trigger products_guard_admin_fields
before update on public.products
for each row execute function private.guard_product_changes();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_slug text := 'closet-' || right(replace(new.id::text, '-', ''), 8);
begin
  insert into public.profiles (id, store_name, slug)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'store_name'), ''), 'Mi closet'),
    generated_slug
  )
  on conflict (id) do nothing;

  insert into public.seller_private_settings (seller_id, phone_e164, whatsapp_e164)
  values (new.id, new.phone, new.phone)
  on conflict (seller_id) do update
    set phone_e164 = excluded.phone_e164,
        whatsapp_e164 = coalesce(public.seller_private_settings.whatsapp_e164, excluded.whatsapp_e164);

  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create function private.sync_auth_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is distinct from old.phone then
    update public.seller_private_settings
    set phone_e164 = new.phone
    where seller_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_phone_updated
after update of phone on auth.users
for each row execute function private.sync_auth_phone();

alter table public.profiles enable row level security;
alter table public.seller_private_settings enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

create policy "Public can read approved seller profiles"
on public.profiles for select to anon, authenticated
using (status = 'approved'::public.seller_status or id = (select auth.uid()) or (select private.is_admin()));

create policy "Seller and admin can update allowed profile data"
on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

create policy "Seller and admin can read private seller settings"
on public.seller_private_settings for select to authenticated
using (seller_id = (select auth.uid()) or (select private.is_admin()));

create policy "Seller and admin can update private seller settings"
on public.seller_private_settings for update to authenticated
using (seller_id = (select auth.uid()) or (select private.is_admin()))
with check (seller_id = (select auth.uid()) or (select private.is_admin()));

create policy "Public can read visible products"
on public.products for select to anon, authenticated
using (
  seller_id = (select auth.uid())
  or (select private.is_admin())
  or (
    publication_status = 'published'::public.product_publication_status
    and not hidden_by_admin
    and exists (
      select 1 from public.profiles p
      where p.id = seller_id and p.status = 'approved'::public.seller_status
    )
  )
);

create policy "Seller and admin can insert owned products"
on public.products for insert to authenticated
with check (
  (select private.is_admin())
  or (
    seller_id = (select auth.uid())
    and not hidden_by_admin
    and exists (
      select 1 from public.profiles p
      where p.id = seller_id and p.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
    )
    and (
      publication_status = 'draft'::public.product_publication_status
      or exists (
        select 1 from public.profiles p
        where p.id = seller_id and p.status = 'approved'::public.seller_status
      )
    )
  )
);

create policy "Seller and admin can update owned products"
on public.products for update to authenticated
using (seller_id = (select auth.uid()) or (select private.is_admin()))
with check (
  (select private.is_admin())
  or (
    seller_id = (select auth.uid())
    and not hidden_by_admin
    and exists (
      select 1 from public.profiles p
      where p.id = seller_id and p.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
    )
    and (
      publication_status = 'draft'::public.product_publication_status
      or exists (
        select 1 from public.profiles p
        where p.id = seller_id and p.status = 'approved'::public.seller_status
      )
    )
  )
);

create policy "Seller and admin can delete owned products"
on public.products for delete to authenticated
using (seller_id = (select auth.uid()) or (select private.is_admin()));

create policy "Public can read images for visible products"
on public.product_images for select to anon, authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.products p
    where p.id = product_id
      and (
        p.seller_id = (select auth.uid())
        or (
          p.publication_status = 'published'::public.product_publication_status
          and not p.hidden_by_admin
          and exists (
            select 1 from public.profiles s
            where s.id = p.seller_id and s.status = 'approved'::public.seller_status
          )
        )
      )
  )
);

create policy "Seller and admin can insert images for owned products"
on public.product_images for insert to authenticated
with check (
  (select private.is_admin())
  or exists (
    select 1 from public.products p
    join public.profiles s on s.id = p.seller_id
    where p.id = product_id
      and p.seller_id = (select auth.uid())
      and s.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
  )
);

create policy "Seller and admin can update images for owned products"
on public.product_images for update to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.products p
    join public.profiles s on s.id = p.seller_id
    where p.id = product_id
      and p.seller_id = (select auth.uid())
      and s.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
  )
)
with check (
  (select private.is_admin())
  or exists (
    select 1 from public.products p
    join public.profiles s on s.id = p.seller_id
    where p.id = product_id
      and p.seller_id = (select auth.uid())
      and s.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
  )
);

create policy "Seller and admin can delete images for owned products"
on public.product_images for delete to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.products p
    join public.profiles s on s.id = p.seller_id
    where p.id = product_id
      and p.seller_id = (select auth.uid())
      and s.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
  )
);

create policy "Public can read storage objects for visible products"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'product-images'
  and (
    (select private.is_admin())
    or exists (
      select 1
      from public.product_images i
      join public.products p on p.id = i.product_id
      join public.profiles s on s.id = p.seller_id
      where i.source = 'storage'::public.product_image_source
        and i.storage_path = name
        and (
          p.seller_id = (select auth.uid())
          or (
            p.publication_status = 'published'::public.product_publication_status
            and not p.hidden_by_admin
            and s.status = 'approved'::public.seller_status
          )
        )
    )
  )
);

create policy "Seller and admin can upload into owned product folders"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (
    (select private.is_admin())
    or (
      split_part(name, '/', 1) = 'sellers'
      and split_part(name, '/', 2) = (select auth.uid())::text
      and split_part(name, '/', 3) = 'products'
      and exists (
        select 1 from public.products p
        join public.profiles s on s.id = p.seller_id
        where p.id::text = split_part(name, '/', 4)
          and p.seller_id = (select auth.uid())
          and s.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
      )
    )
  )
);

create policy "Seller and admin can update objects in owned product folders"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and (
    (select private.is_admin())
    or (
      split_part(name, '/', 1) = 'sellers'
      and split_part(name, '/', 2) = (select auth.uid())::text
      and split_part(name, '/', 3) = 'products'
      and exists (
        select 1 from public.products p
        join public.profiles s on s.id = p.seller_id
        where p.id::text = split_part(name, '/', 4)
          and p.seller_id = (select auth.uid())
          and s.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
      )
    )
  )
)
with check (
  bucket_id = 'product-images'
  and (
    (select private.is_admin())
    or (
      split_part(name, '/', 1) = 'sellers'
      and split_part(name, '/', 2) = (select auth.uid())::text
      and split_part(name, '/', 3) = 'products'
      and exists (
        select 1 from public.products p
        join public.profiles s on s.id = p.seller_id
        where p.id::text = split_part(name, '/', 4)
          and p.seller_id = (select auth.uid())
          and s.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
      )
    )
  )
);

create policy "Seller and admin can delete objects in owned product folders"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (
    (select private.is_admin())
    or (
      split_part(name, '/', 1) = 'sellers'
      and split_part(name, '/', 2) = (select auth.uid())::text
      and split_part(name, '/', 3) = 'products'
      and exists (
        select 1 from public.products p
        join public.profiles s on s.id = p.seller_id
        where p.id::text = split_part(name, '/', 4)
          and p.seller_id = (select auth.uid())
          and s.status in ('pending'::public.seller_status, 'approved'::public.seller_status)
      )
    )
  )
);

grant select on public.profiles, public.products, public.product_images to anon, authenticated;
grant select, update on public.seller_private_settings to authenticated;
grant insert, update, delete on public.products, public.product_images to authenticated;
grant update on public.profiles to authenticated;
