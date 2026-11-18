create or replace function private.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    if new.slug is distinct from old.slug then
      raise exception 'Only an admin can change profile slugs';
    end if;
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only an admin can change profile role or status';
    end if;
  end if;
  return new;
end;
$$;
