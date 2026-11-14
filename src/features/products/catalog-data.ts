import type { CatalogFilters, CatalogImage, CatalogPageResult, CatalogProduct } from "@/features/products/types";
import { getDemoCatalogPage } from "@/features/products/demo-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const CATALOG_PAGE_SIZE = 24;

type ProductImageRow = Omit<CatalogImage, "url">;
type ProductRow = Omit<CatalogProduct, "seller" | "images"> & {
  seller: CatalogProduct["seller"] | null;
  images: ProductImageRow[] | null;
};

function localImageUrl(image: ProductImageRow) {
  return image.source === "local_placeholder" ? image.storage_path : "";
}

export async function getCatalogPage(filters: CatalogFilters): Promise<CatalogPageResult> {
  if (process.env.CATALOG_DEMO_MODE === "true") {
    return { ...getDemoCatalogPage(filters, CATALOG_PAGE_SIZE), error: null };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { products: [], total: 0, error: "Configura la conexión con Supabase para cargar el catálogo." };
  }

  let query = supabase
    .from("products")
    .select(
      "id,slug,name,description,category,size,condition,price_mxn,sale_status,created_at,seller:profiles!products_seller_id_fkey(store_name,slug),images:product_images(id,source,storage_path,alt_text,position)",
      { count: "exact" },
    )
    .eq("publication_status", "published");

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
  const storagePaths = rows.flatMap((product) =>
    (product.images ?? [])
      .filter((image) => image.source === "storage")
      .map((image) => image.storage_path),
  );
  const signedUrls = new Map<string, string>();

  if (storagePaths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from("product-images")
      .createSignedUrls(storagePaths, 3600);

    for (const item of signedData ?? []) {
      if (item.path && item.signedUrl) signedUrls.set(item.path, item.signedUrl);
    }
  }

  const products = rows.flatMap((row): CatalogProduct[] => {
    if (!row.seller) return [];

    const images = (row.images ?? [])
      .toSorted((left, right) => left.position - right.position)
      .map((image): CatalogImage => ({
        ...image,
        url: localImageUrl(image) || signedUrls.get(image.storage_path) || "/placeholders/top-front.svg",
      }));

    return [{ ...row, seller: row.seller, images }];
  });

  return { products, total: count ?? 0, error: null };
}
