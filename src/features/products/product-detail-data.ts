import "server-only";

import { cache } from "react";
import type { CatalogImage, CatalogProduct } from "@/features/products/types";
import { demoProducts } from "@/features/products/demo-catalog";
import { getProductImageUrl, getSellerAvatarUrl } from "@/features/products/public-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProductImageRow = Omit<CatalogImage, "url">;
type ProductRow = Omit<CatalogProduct, "seller" | "images"> & {
  seller: CatalogProduct["seller"] | null;
  images: ProductImageRow[] | null;
};

function mapProductRow(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  row: ProductRow,
): CatalogProduct | null {
  if (!row.seller) return null;

  return {
    ...row,
    seller: {
      ...row.seller,
      avatar_path: getSellerAvatarUrl(supabase, row.seller.avatar_path),
    },
    images: (row.images ?? [])
      .toSorted((left, right) => left.position - right.position)
      .map((image) => ({ ...image, url: getProductImageUrl(supabase, image) })),
  };
}

export const getProductDetail = cache(async (slug: string): Promise<CatalogProduct | null> => {
  if (process.env.CATALOG_DEMO_MODE === "true") {
    return demoProducts.find((product) => product.slug === slug) ?? null;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured for product details.");

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,slug,name,description,category,size,measurements,condition,price_mxn,sale_status,created_at,seller:profiles!products_seller_id_fkey(store_name,slug,avatar_path),images:product_images(id,source,storage_path,alt_text,position,width,height)",
    )
    .eq("slug", slug)
    .eq("publication_status", "published")
    .maybeSingle();

  if (error) throw new Error(`Could not load product details: ${error.message}`);
  if (!data) return null;

  return mapProductRow(supabase, data as unknown as ProductRow);
});

export const getMoreFromSeller = cache(async (sellerSlug: string, productId: string) => {
  if (process.env.CATALOG_DEMO_MODE === "true") {
    const current = demoProducts.find((product) => product.id === productId);
    if (!current) return [];
    return demoProducts
      .filter((product) => product.seller.slug === sellerSlug && product.id !== productId)
      .slice(0, 4);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data: seller, error: sellerError } = await supabase
    .from("profiles")
    .select("id")
    .eq("slug", sellerSlug)
    .maybeSingle();

  if (sellerError || !seller) return [];

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,slug,name,description,category,size,condition,price_mxn,sale_status,created_at,seller:profiles!products_seller_id_fkey(store_name,slug,avatar_path),images:product_images(id,source,storage_path,alt_text,position,width,height)",
    )
    .eq("seller_id", seller.id)
    .eq("publication_status", "published")
    .neq("id", productId)
    .order("created_at", { ascending: false })
    .limit(4);

  if (error) return [];
  return (data ?? [])
    .map((row) => mapProductRow(supabase, row as unknown as ProductRow))
    .filter((product): product is CatalogProduct => product !== null);
});
