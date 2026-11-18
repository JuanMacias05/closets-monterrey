create or replace function private.guard_product_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if (select private.is_admin()) then
    if old.seller_id <> (select auth.uid())
       and (to_jsonb(new) - 'hidden_by_admin') is distinct from (to_jsonb(old) - 'hidden_by_admin') then
      raise exception 'Admins may only change hidden_by_admin on another seller product';
    end if;
    return new;
  end if;

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

  return new;
end;
$$;

drop policy if exists "Approved seller can update own products" on public.products;
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
with check (seller_id = (select auth.uid()));

create policy "Admins can update visibility of other sellers products"
on public.products for update to authenticated
using (
  (select private.is_admin())
  and seller_id <> (select auth.uid())
)
with check (
  (select private.is_admin())
  and seller_id <> (select auth.uid())
);
