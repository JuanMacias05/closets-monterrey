import "server-only";

import { getCourierDirectory } from "@/features/couriers/directory";
import { feesFromOrigin, type ZoneRateRow } from "@/features/delivery/zone-rates";
import type { SellerDeliveryOptions } from "@/features/shop/checkout-steps";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SellerDeliverySettings = {
  id: string;
  home_delivery_enabled: boolean;
  home_delivery_origin: string | null;
  home_delivery_note: string | null;
};

// Each seller's delivery options for the checkout's delivery step: her fixed points, home
// delivery priced from her origin, and the couriers who collect at one of her points. Shared by
// the cart (reserving) and /cuenta (choosing again after a courier says no), so both offer
// exactly what the reservation functions accept.
export async function getSellerDeliveryOptions(sellers: readonly SellerDeliverySettings[]): Promise<Map<string, SellerDeliveryOptions>> {
  const result = new Map<string, SellerDeliveryOptions>();
  const supabase = await createSupabaseServerClient();
  if (!supabase || sellers.length === 0) return result;

  const sellerIds = [...new Set(sellers.map((seller) => seller.id))];
  // Home delivery is priced from each seller's origin to the buyer's municipality; she picks the
  // municipality on screen, so every destination from those origins comes along.
  const origins = [...new Set(sellers.map((seller) => seller.home_delivery_origin).filter((origin): origin is string => origin !== null))];
  const [{ data: pointRows }, { data: rateRows }, couriers] = await Promise.all([
    supabase.from("seller_delivery_points").select("seller_id,point:delivery_points(id,name,sort_order)").in("seller_id", sellerIds),
    origins.length
      ? supabase.from("delivery_zone_rates").select("origin_municipality,destination_municipality,fee_mxn").in("origin_municipality", origins)
      : Promise.resolve({ data: [] as ZoneRateRow[] }),
    getCourierDirectory(),
  ]);

  type PointRow = { seller_id: string; point: { id: string; name: string; sort_order: number } | null };
  const pointsBySeller = new Map<string, { id: string; name: string; sort_order: number }[]>();
  for (const row of (pointRows ?? []) as unknown as PointRow[]) {
    // Inactive points come back as null (RLS hides them) and are skipped.
    if (!row.point) continue;
    pointsBySeller.set(row.seller_id, [...(pointsBySeller.get(row.seller_id) ?? []), row.point]);
  }
  const rates = (rateRows ?? []) as ZoneRateRow[];

  for (const seller of sellers) {
    const points = (pointsBySeller.get(seller.id) ?? []).toSorted((a, b) => a.sort_order - b.sort_order);
    const pointIds = new Set(points.map((point) => point.id));
    result.set(seller.id, {
      points: points.map(({ id, name }) => ({ id, name })),
      // Without an origin there is nothing to price from, so it isn't offered (the reservation
      // functions refuse it too).
      homeDelivery: seller.home_delivery_enabled && seller.home_delivery_origin
        ? { origin: seller.home_delivery_origin, note: seller.home_delivery_note, feesByMunicipality: feesFromOrigin(rates, seller.home_delivery_origin) }
        : null,
      // A courier fits this seller only if she collects at a point the seller reaches.
      couriers: couriers
        .filter((courier) => courier.pointIds.some((id) => pointIds.has(id)))
        .map((courier) => ({
          id: courier.id, fullName: courier.fullName, municipalities: courier.municipalities, feeMxn: courier.feeMxn,
          // Only the points she shares with this seller: that is where she would collect.
          pointNames: courier.pointIds.flatMap((id, index) => (pointIds.has(id) ? [courier.pointNames[index]!] : [])),
          days: courier.days, timeWindow: courier.timeWindow, rating: courier.rating, deliveries: courier.deliveries,
        })),
    });
  }
  return result;
}
