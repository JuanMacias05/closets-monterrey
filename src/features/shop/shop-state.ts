import "server-only";

import { cache } from "react";
import { canShop, getViewer } from "@/features/viewer/get-viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ShopState = {
  signedIn: boolean;
  favoriteIds: Set<string>;
  cartIds: Set<string>;
};

const EMPTY: ShopState = { signedIn: false, favoriteIds: new Set(), cartIds: new Set() };

// The viewer's favorites and cart as id sets, so every card on a page can draw its heart
// and cart state without a query each. Cached per request.
export const getShopState = cache(async (): Promise<ShopState> => {
  const viewer = await getViewer();
  if (!canShop(viewer)) return { ...EMPTY, signedIn: viewer.kind !== "guest" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return EMPTY;

  const [{ data: favorites }, { data: cart }] = await Promise.all([
    supabase.from("favorites").select("product_id"),
    supabase.from("cart_items").select("product_id"),
  ]);
  return {
    signedIn: true,
    favoriteIds: new Set((favorites ?? []).map((row) => row.product_id)),
    cartIds: new Set((cart ?? []).map((row) => row.product_id)),
  };
});
