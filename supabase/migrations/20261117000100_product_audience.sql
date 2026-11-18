-- Who a garment is for, so the storefront can split into Mujer / Hombre.
-- Every product that already exists was listed by a women's-wear seller, so the default
-- backfills them as 'women'; sellers pick the value explicitly from now on.
-- 'unisex' garments appear under both Mujer and Hombre.
create type public.product_audience as enum ('women', 'men', 'unisex');

alter table public.products
  add column audience public.product_audience not null default 'women';

create index products_audience_published_idx
  on public.products (audience, publication_status, sale_status, created_at desc);
