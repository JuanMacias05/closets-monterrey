import type { CatalogFilters, CatalogImage, CatalogPageResult, CatalogProduct } from "@/features/products/types";
import { getDemoCatalogPage } from "@/features/products/demo-catalog";
import { getProductImageUrl } from "@/features/products/public-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const CATALOG_PAGE_SIZE = 24;

type ProductImageRow = Omit<CatalogImage, "url">;
type ProductRow = Omit<CatalogProduct, "seller" | "images"> & {
  seller: CatalogProduct["seller"] | null;
  images: ProductImageRow[] | null;
};

export async function getCatalogPage(filters: CatalogFilters): Promise<CatalogPageResult> {
  if (process.env.CATALOG_DEMO_MODE === "true") {
    return { ...getDemoCatalogPage(filters, CATALOG_PAGE_SIZE), error: null };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { products: [], total: 0, error: "Configura la conexión con Supabase para cargar el catálogo." };
  }

  // Unpaid reservations release lazily (there is no scheduler); doing it here means a
  // garment whose 24 h ran out shows as available the next time anyone opens the catalog.
  await supabase.rpc("release_expired_reservations");

  let query = supabase
    .from("products")
    .select(
      "id,slug,name,description,category,audience,size,condition,price_mxn,sale_status,created_at,seller_id,seller:profiles!products_seller_id_fkey(store_name,slug,avatar_path),images:product_images(id,source,storage_path,alt_text,position,width,height)",
      { count: "exact" },
    )
    .eq("publication_status", "published");
  query = query.eq("hidden_by_admin", false);

  if (filters.delivery) {
    const { data: sellers } = filters.delivery === "domicilio"
      ? await supabase.from("profiles").select("id").eq("home_delivery_enabled", true)
      : await supabase.from("seller_delivery_points").select("id:seller_id").eq("point_id", filters.delivery);
    const sellerIds = (sellers ?? []).map((row) => row.id as string);
    if (sellerIds.length === 0) return { products: [], total: 0, error: null };
    query = query.in("seller_id", sellerIds);
  }

  if (filters.audience) query = query.in("audience", [filters.audience, "unisex"]);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.size) query = query.eq("size", filters.size);
  if (filters.condition) query = query.eq("condition", filters.condition);
  if (filters.minPrice !== undefined) query = query.gte("price_mxn", filters.minPrice * 100);
  if (filters.maxPrice !== undefined) query = query.lte("price_mxn", filters.maxPrice * 100);
  if (filters.hideSold) query = query.neq("sale_status", "sold");

  query = query.order("sale_status", { ascending: true });
  if (filters.sort === "price-asc") query = query.order("price_mxn", { ascending: true });
  else if (filters.sort === "price-desc") query = query.order("price_mxn", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  query = query.order("id", { ascending: true });

  const start = (filters.page - 1) * CATALOG_PAGE_SIZE;
  const { data, count, error } = await query.range(start, start + CATALOG_PAGE_SIZE - 1);

  if (error) {
    return { products: [], total: 0, error: "No pudimos conectar con el catálogo. Revisa las migraciones y vuelve a intentar." };
  }

  const rows = (data ?? []) as unknown as ProductRow[];
  const products = rows.flatMap((row): CatalogProduct[] => {
    if (!row.seller) return [];

    const images = (row.images ?? [])
      .toSorted((left, right) => left.position - right.position)
      .map((image): CatalogImage => ({
        ...image,
        url: getProductImageUrl(supabase, image),
      }));

    return [{ ...row, seller: row.seller, images }];
  });

  return { products, total: count ?? 0, error: null };
}
