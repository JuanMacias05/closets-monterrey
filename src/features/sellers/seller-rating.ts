import "server-only";

import { cache } from "react";
import type { SellerRating } from "@/features/sellers/seller-rating-label";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// A store's public average and count (seller_stats, 20261128000100). Cached per request.
export const getSellerRating = cache(async (sellerId: string): Promise<SellerRating> => {
  if (!/^[0-9a-f-]{36}$/i.test(sellerId)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc("seller_stats", { seller_ids: [sellerId] });
  const row = ((data ?? []) as { seller_id: string; ratings: number; rating: number | string }[])[0];
  return row ? { ratings: row.ratings, rating: Number(row.rating) } : null;
});
