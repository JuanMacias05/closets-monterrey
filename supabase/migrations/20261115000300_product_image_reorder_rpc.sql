alter table public.product_images
  drop constraint product_images_product_position_unique,
  add constraint product_images_product_position_unique
    unique (product_id, position)
    deferrable initially deferred;

create or replace function public.reorder_product_images(
  target_product_id uuid,
  ordered_image_ids uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_count integer;
begin
  if caller_id is null or not exists (
    select 1 from public.profiles p
    where p.id = caller_id
      and p.status = 'approved'::public.seller_status
      and p.role in ('seller'::public.user_role, 'admin'::public.user_role)
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.products p
    where p.id = target_product_id and p.seller_id = caller_id
  ) then
    raise exception 'Product not found or not owned';
  end if;

  select count(*)::integer into current_count
  from public.product_images i where i.product_id = target_product_id;

  if coalesce(cardinality(ordered_image_ids), 0) <> current_count
     or (select count(distinct image_id) from unnest(coalesce(ordered_image_ids, '{}'::uuid[])) image_id) <> current_count
     or exists (
       select 1 from unnest(coalesce(ordered_image_ids, '{}'::uuid[])) requested(image_id)
       where not exists (
         select 1 from public.product_images i
         where i.id = requested.image_id and i.product_id = target_product_id
       )
     ) then
    raise exception 'Image order must contain every product image exactly once';
  end if;

  update public.product_images i
  set position = requested.position::integer - 1
  from unnest(ordered_image_ids) with ordinality requested(image_id, position)
  where i.id = requested.image_id and i.product_id = target_product_id;
end;
$$;

revoke all on function public.reorder_product_images(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_product_images(uuid, uuid[]) to authenticated;

drop policy if exists "Seller and admin can insert owned products" on public.products;
create policy "Approved seller can insert own products"
on public.products for insert to authenticated
with check (
  seller_id = (select auth.uid())
  and not hidden_by_admin
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'approved'::public.seller_status
      and p.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);

drop policy if exists "Seller and admin can update owned products" on public.products;
create policy "Approved seller can update own products"
on public.products for update to authenticated
using (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'approved'::public.seller_status
      and p.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
)
with check (seller_id = (select auth.uid()) and not hidden_by_admin);

drop policy if exists "Seller and admin can delete owned products" on public.products;
create policy "Approved seller can delete own products"
on public.products for delete to authenticated
using (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'approved'::public.seller_status
      and p.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);

drop policy if exists "Seller and admin can insert images for owned products" on public.product_images;
create policy "Approved seller can insert images for own products"
on public.product_images for insert to authenticated
with check (
  exists (
    select 1 from public.products p
    join public.profiles s on s.id = p.seller_id
    where p.id = product_id and p.seller_id = (select auth.uid())
      and s.status = 'approved'::public.seller_status
      and s.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);

drop policy if exists "Seller and admin can update images for owned products" on public.product_images;
create policy "Approved seller can update images for own products"
on public.product_images for update to authenticated
using (
  exists (
    select 1 from public.products p join public.profiles s on s.id = p.seller_id
    where p.id = product_id and p.seller_id = (select auth.uid())
      and s.status = 'approved'::public.seller_status
      and s.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
)
with check (
  exists (
    select 1 from public.products p join public.profiles s on s.id = p.seller_id
    where p.id = product_id and p.seller_id = (select auth.uid())
      and s.status = 'approved'::public.seller_status
      and s.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);

drop policy if exists "Seller and admin can delete images for owned products" on public.product_images;
create policy "Approved seller can delete images for own products"
on public.product_images for delete to authenticated
using (
  exists (
    select 1 from public.products p join public.profiles s on s.id = p.seller_id
    where p.id = product_id and p.seller_id = (select auth.uid())
      and s.status = 'approved'::public.seller_status
      and s.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);

drop policy if exists "Seller and admin can upload into owned product folders" on storage.objects;
create policy "Approved seller can upload into own product folders"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and split_part(name, '/', 1) = 'sellers'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and split_part(name, '/', 3) = 'products'
  and exists (
    select 1 from public.products p join public.profiles s on s.id = p.seller_id
    where p.id::text = split_part(name, '/', 4) and p.seller_id = (select auth.uid())
      and s.status = 'approved'::public.seller_status
      and s.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);

drop policy if exists "Seller and admin can update objects in owned product folders" on storage.objects;
create policy "Approved seller can update objects in own product folders"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and split_part(name, '/', 1) = 'sellers'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and split_part(name, '/', 3) = 'products'
  and exists (
    select 1 from public.products p join public.profiles s on s.id = p.seller_id
    where p.id::text = split_part(name, '/', 4) and p.seller_id = (select auth.uid())
      and s.status = 'approved'::public.seller_status
      and s.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
)
with check (
  bucket_id = 'product-images'
  and split_part(name, '/', 1) = 'sellers'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and split_part(name, '/', 3) = 'products'
  and exists (
    select 1 from public.products p join public.profiles s on s.id = p.seller_id
    where p.id::text = split_part(name, '/', 4) and p.seller_id = (select auth.uid())
      and s.status = 'approved'::public.seller_status
      and s.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);

drop policy if exists "Seller and admin can delete objects in owned product folders" on storage.objects;
create policy "Seller can delete files in own product folders"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and split_part(name, '/', 1) = 'sellers'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and split_part(name, '/', 3) = 'products'
  and split_part(name, '/', 4) ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'approved'::public.seller_status
      and p.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);
