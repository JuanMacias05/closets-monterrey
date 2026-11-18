create or replace function private.is_valid_clabe(p_clabe text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select p_clabe ~ '^[0-9]{18}$'
    and right(p_clabe, 1)::integer = (
      10 - (
        select coalesce(sum(
          (substring(p_clabe from g.i for 1)::integer
            * (array[3, 7, 1])[(g.i - 1) % 3 + 1]) % 10
        ), 0) % 10
        from generate_series(1, 17) as g(i)
      )
    ) % 10;
$$;

grant execute on function private.is_valid_clabe(text) to authenticated, service_role;

alter table public.seller_private_settings
  drop constraint seller_clabe_format;

alter table public.seller_private_settings
  add constraint seller_clabe_format
  check (clabe is null or private.is_valid_clabe(clabe));

create policy "Approved sellers can upload own store avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'sellers'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (storage.foldername(name))[3] = 'avatar'
  and storage.extension(name) = 'jpg'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'approved'::public.seller_status
      and p.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);

create policy "Approved sellers can read own store avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'sellers'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (storage.foldername(name))[3] = 'avatar'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'approved'::public.seller_status
      and p.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);

create policy "Approved sellers can delete own store avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'sellers'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (storage.foldername(name))[3] = 'avatar'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'approved'::public.seller_status
      and p.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);
