-- GoTrue stores phone identities as digits without the leading plus. Keep the
-- seller-facing phone mirror in E.164, as required by its table constraint.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_slug text := 'closet-' || right(replace(new.id::text, '-', ''), 8);
  v_phone_e164 text := case
    when new.phone is null then null
    when left(new.phone, 1) = '+' then new.phone
    else '+' || new.phone
  end;
begin
  insert into public.profiles (id, store_name, slug)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'store_name'), ''), 'Mi closet'),
    generated_slug
  )
  on conflict (id) do nothing;

  insert into public.seller_private_settings (seller_id, phone_e164, whatsapp_e164)
  values (new.id, v_phone_e164, v_phone_e164)
  on conflict (seller_id) do update
    set phone_e164 = excluded.phone_e164,
        whatsapp_e164 = coalesce(public.seller_private_settings.whatsapp_e164, excluded.whatsapp_e164);

  return new;
end;
$$;

create or replace function private.sync_auth_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone_e164 text := case
    when new.phone is null then null
    when left(new.phone, 1) = '+' then new.phone
    else '+' || new.phone
  end;
begin
  if new.phone is distinct from old.phone then
    update public.seller_private_settings
    set phone_e164 = v_phone_e164
    where seller_id = new.id;
  end if;
  return new;
end;
$$;
