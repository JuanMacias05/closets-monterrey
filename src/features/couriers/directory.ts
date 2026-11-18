import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CourierCard = {
  id: string; fullName: string; municipalities: string[]; days: number[]; timeWindow: string | null;
  feeMxn: number; pointIds: string[]; pointNames: string[]; deliveries: number; rating: number | null;
};

// Approved couriers with their pickup points and public stats. Cached per request: the
// catalog sidebar, the directory and the cart all read it.
export const getCourierDirectory = cache(async (): Promise<CourierCard[]> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const [{ data: couriers }, { data: points }, { data: stats }] = await Promise.all([
    supabase.from("couriers").select("id,full_name,municipalities,days,time_window,fee_mxn").eq("status", "approved").order("full_name"),
    supabase.from("courier_pickup_points").select("courier_id,point:delivery_points(id,name)"),
    supabase.rpc("courier_stats"),
  ]);
  type PointRow = { courier_id: string; point: { id: string; name: string } | null };
  const statsById = new Map(((stats ?? []) as { courier_id: string; deliveries: number; rating: number | null }[]).map((row) => [row.courier_id, row]));
  return (couriers ?? []).map((courier) => {
    const mine = ((points ?? []) as unknown as PointRow[]).filter((row) => row.courier_id === courier.id && row.point);
    const stat = statsById.get(courier.id);
    return {
      id: courier.id, fullName: courier.full_name, municipalities: courier.municipalities ?? [], days: courier.days ?? [],
      timeWindow: courier.time_window, feeMxn: courier.fee_mxn,
      pointIds: mine.map((row) => row.point!.id), pointNames: mine.map((row) => row.point!.name),
      deliveries: stat?.deliveries ?? 0, rating: stat?.rating === null || stat?.rating === undefined ? null : Number(stat.rating),
    };
  });
});
