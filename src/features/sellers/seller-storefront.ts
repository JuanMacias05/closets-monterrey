import "server-only";

import { cache } from "react";
import { feeRange, feesFromOrigin, type ZoneRateRow } from "@/features/delivery/zone-rates";
import { getSellerAvatarUrl } from "@/features/products/public-images";
import { demoProducts } from "@/features/products/demo-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SellerDelivery = {
  points: string[];
  // From the zone rates: the cheapest and dearest destination from where she ships.
  home: { origin: string; minFeeMxn: number; maxFeeMxn: number; note: string | null } | null;
};

export type SellerPublicProfile = {
  id: string;
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

  if (!supabase) return demoSeller ? { id: "", storeName: demoSeller.store_name, slug, avatarUrl: null, delivery: NO_DELIVERY } : null;

  const profileQuery = supabase.from("profiles").select("id,store_name,slug,avatar_path,home_delivery_enabled,home_delivery_origin,home_delivery_note");
  const { data: profile } = demoSeller
    ? await profileQuery.eq("store_name", demoSeller.store_name).maybeSingle()
    : await profileQuery.eq("slug", slug).maybeSingle();

  if (!profile) return demoSeller ? { id: "", storeName: demoSeller.store_name, slug, avatarUrl: null, delivery: NO_DELIVERY } : null;

  const origin = profile.home_delivery_enabled ? profile.home_delivery_origin as string | null : null;
  const [{ data: points }, { data: rateRows }] = await Promise.all([
    supabase.from("seller_delivery_points")
      .select("point:delivery_points(name,sort_order,active)")
      .eq("seller_id", profile.id),
    origin
      ? supabase.from("delivery_zone_rates").select("origin_municipality,destination_municipality,fee_mxn").eq("origin_municipality", origin)
      : Promise.resolve({ data: [] as ZoneRateRow[] }),
  ]);
  const homeRange = origin ? feeRange(feesFromOrigin((rateRows ?? []) as ZoneRateRow[], origin)) : null;
  type PointRow = { point: { name: string; sort_order: number; active: boolean } | null };
  const pointNames = ((points ?? []) as unknown as PointRow[])
    .filter((row) => row.point?.active)
    .toSorted((left, right) => (left.point!.sort_order - right.point!.sort_order))
    .map((row) => row.point!.name);

  return {
    id: profile.id,
    storeName: profile.store_name,
    slug,
    avatarUrl: getSellerAvatarUrl(supabase, profile.avatar_path),
    delivery: {
      points: pointNames,
      // No origin or no rates: not offered at checkout either, so not announced here.
      home: origin && homeRange ? { origin, minFeeMxn: homeRange.min, maxFeeMxn: homeRange.max, note: profile.home_delivery_note } : null,
    },
  };
});
