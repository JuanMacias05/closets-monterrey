create policy "Approved sellers can read own product image objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-images'
  and split_part(name, '/', 1) = 'sellers'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'approved'::public.seller_status
      and p.role in ('seller'::public.user_role, 'admin'::public.user_role)
  )
);
