import type { CatalogFilters, CatalogImage, CatalogPageResult, CatalogProduct } from "@/features/products/types";
import { getDemoCatalogPage } from "@/features/products/demo-catalog";
import { getProductImageUrl } from "@/features/products/public-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const CATALOG_PAGE_SIZE = 24;

const PAGE_PAST_THE_END = "PGRST103";

// The home page shows only new arrivals: garments published in the last NEW_ARRIVALS_DAYS.
// With fewer than NEW_ARRIVALS_MINIMUM of them the page would look empty, so it falls back to
// the whole catalog (newest first), which is what a quiet week should still show.
export const NEW_ARRIVALS_DAYS = 14;
export const NEW_ARRIVALS_MINIMUM = 8;

// "Now" for the new-arrivals cutoff. The demo catalog (local e2e) has fixed dates, so its runs
// pin the clock with CATALOG_DEMO_NOW; otherwise the split would drift a day at a time.
export function newArrivalsSince(): string {
  const pinned = process.env.CATALOG_DEMO_MODE === "true" ? process.env.CATALOG_DEMO_NOW : undefined;
  const now = pinned ? Date.parse(pinned) : Date.now();
  return new Date(now - NEW_ARRIVALS_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function countNewArrivals(sinceIso: string): Promise<number> {
  if (process.env.CATALOG_DEMO_MODE === "true") {
    return getDemoCatalogPage({ hideSold: false, sort: "recent", page: 1, newSince: sinceIso }, 1).total;
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return 0;
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true })
    .eq("publication_status", "published").eq("hidden_by_admin", false).gte("created_at", sinceIso);
  return count ?? 0;
}

type ProductImageRow = Omit<CatalogImage, "url">;
type ProductRow = Omit<CatalogProduct, "seller" | "images"> & {
  seller: CatalogProduct["seller"] | null;
  images: ProductImageRow[] | null;
};

export async function getCatalogPage(filters: CatalogFilters, pageSize = CATALOG_PAGE_SIZE): Promise<CatalogPageResult> {
  if (process.env.CATALOG_DEMO_MODE === "true") {
    return { ...getDemoCatalogPage(filters, pageSize), error: null };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { products: [], total: 0, error: "Configura la conexión con Supabase para cargar el catálogo." };
  }

  // Unpaid reservations release lazily (there is no scheduler); doing it here means a
  // garment whose 24 h ran out shows as available the next time anyone opens the catalog.
  await supabase.rpc("release_expired_reservations");

  const columns = "id,slug,name,description,category,audience,size,condition,price_mxn,sale_status,created_at,seller_id,seller:profiles!products_seller_id_fkey(store_name,slug,avatar_path),images:product_images(id,source,storage_path,alt_text,position,width,height)";
  // A search starts from search_products (the same product rows, already matched in Postgres)
  // so every filter, order and page below applies to search results unchanged.
  let query = filters.q
    ? supabase.rpc("search_products", { search: filters.q }, { count: "exact" }).select(columns)
    : supabase.from("products").select(columns, { count: "exact" });
  query = query.eq("publication_status", "published");
  query = query.eq("hidden_by_admin", false);

  if (filters.delivery) {
    const { data: sellers } = filters.delivery === "domicilio"
      // Same rule as checkout: home delivery counts only with an origin to price it from.
      ? await supabase.from("profiles").select("id").eq("home_delivery_enabled", true).not("home_delivery_origin", "is", null)
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
  if (filters.newSince) query = query.gte("created_at", filters.newSince);

  query = query.order("sale_status", { ascending: true });
  if (filters.sort === "price-asc") query = query.order("price_mxn", { ascending: true });
  else if (filters.sort === "price-desc") query = query.order("price_mxn", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  query = query.order("id", { ascending: true });

  const start = (filters.page - 1) * pageSize;
  const { data, count, error } = await query.range(start, start + pageSize - 1);

  // PostgREST answers a range past the last row with PGRST103 (HTTP 416) instead of an empty
  // list. That is an old ?page=N link after garments sold, not the catalog being down: hand back
  // an empty page and let the page send the shopper to page 1.
  if (error?.code === PAGE_PAST_THE_END) {
    return { products: [], total: 0, error: null };
  }

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
