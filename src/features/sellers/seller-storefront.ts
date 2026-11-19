import "server-only";

import { cache } from "react";
import { getSellerAvatarUrl } from "@/features/products/public-images";
import { demoProducts } from "@/features/products/demo-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SellerDelivery = {
  points: string[];
  home: { feeMxn: number; note: string | null } | null;
};

export type SellerPublicProfile = {
  storeName: string;
  slug: string;
  avatarUrl: string | null;
  delivery: SellerDelivery;
};

const NO_DELIVERY: SellerDelivery = { points: [], home: null };

// A seller's public face: name, photo and where she hands garments over. Shown on her
// storefront (/tiendas/[slug]) and under each of her garments, so a shopper knows before
// reserving whether the seller reaches her. Only approved sellers are readable (RLS).
export const getSellerPublicProfile = cache(async (slug: string): Promise<SellerPublicProfile | null> => {
  const supabase = await createSupabaseServerClient();

  // Demo mode (local e2e) serves garments from demo-catalog, whose seller slugs differ from
  // the seeded ones; the seeded profile is found by its store name instead.
  const demoSeller = process.env.CATALOG_DEMO_MODE === "true"
    ? demoProducts.find((product) => product.seller.slug === slug)?.seller
    : undefined;

  if (!supabase) return demoSeller ? { storeName: demoSeller.store_name, slug, avatarUrl: null, delivery: NO_DELIVERY } : null;

  const profileQuery = supabase.from("profiles").select("id,store_name,slug,avatar_path,home_delivery_enabled,home_delivery_fee_mxn,home_delivery_note");
  const { data: profile } = demoSeller
    ? await profileQuery.eq("store_name", demoSeller.store_name).maybeSingle()
    : await profileQuery.eq("slug", slug).maybeSingle();

  if (!profile) return demoSeller ? { storeName: demoSeller.store_name, slug, avatarUrl: null, delivery: NO_DELIVERY } : null;

  const { data: points } = await supabase.from("seller_delivery_points")
    .select("point:delivery_points(name,sort_order,active)")
    .eq("seller_id", profile.id);
  type PointRow = { point: { name: string; sort_order: number; active: boolean } | null };
  const pointNames = ((points ?? []) as unknown as PointRow[])
    .filter((row) => row.point?.active)
    .toSorted((left, right) => (left.point!.sort_order - right.point!.sort_order))
    .map((row) => row.point!.name);

  return {
    storeName: profile.store_name,
    slug,
    avatarUrl: getSellerAvatarUrl(supabase, profile.avatar_path),
    delivery: {
      points: pointNames,
      home: profile.home_delivery_enabled ? { feeMxn: profile.home_delivery_fee_mxn, note: profile.home_delivery_note } : null,
    },
  };
});
