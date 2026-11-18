# closets-monterrey-nl

## Autenticación por teléfono

`auth.enable_signup = false` en `supabase/config.toml` es temporal durante el bloque de login. Hay que habilitar el registro en la fase de registro de vendedoras, cuando exista el flujo controlado para dar de alta sus cuentas.

Para crear una cuenta administradora en un proyecto remoto:

1. Crea la cuenta de Auth desde **Supabase Dashboard → Authentication → Users → Add user** y confirma su teléfono. No guardes el teléfono en este repositorio.
2. Copia el UUID de esa cuenta y ejecuta en **SQL Editor**:

```sql
update public.profiles
set role = 'admin', status = 'approved'
where id = 'PEGA-AQUI-EL-UUID-DE-AUTH';

insert into public.seller_private_settings (seller_id)
select id
from public.profiles
where id = 'PEGA-AQUI-EL-UUID-DE-AUTH'
on conflict (seller_id) do nothing;
```

El esquema actual asigna un solo rol (`admin` o `seller`). La admin aprobada puede administrar productos de vendedoras; si se requiere una tienda propia independiente para esa misma cuenta, habrá que definir roles/capacidades múltiples en una fase posterior.

GoTrue guarda el teléfono de Auth sin el `+`; la tabla de datos privados de vendedora conserva el formato E.164 con `+`. El trigger de la migración mantiene esa conversión automáticamente, así que el SQL de asignación por UUID no necesita consultar ni guardar el teléfono.

## SMS en producción

El proveedor y sus credenciales se configuran en **Supabase Dashboard → Authentication → Providers → Phone**. La configuración local de `supabase/config.toml` no configura el proveedor del proyecto remoto. Usa las credenciales en el dashboard/gestor de secretos y nunca subas tokens al repositorio.
