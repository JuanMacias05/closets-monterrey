import { CourierRouteForm } from "@/app/recolectora/courier-route-form";
import { requireCourier } from "@/features/couriers/require-courier";

export const metadata = { title: "Mi ruta | Closets Monterrey" };

export default async function CourierRoutePage() {
  const { viewer, supabase } = await requireCourier("/recolectora/ruta");
  const [{ data: courier }, { data: myPoints }, { data: points }] = await Promise.all([
    supabase.from("couriers").select("municipalities,days,time_window").eq("id", viewer.userId).single(),
    supabase.from("courier_pickup_points").select("point_id").eq("courier_id", viewer.userId),
    supabase.from("delivery_points").select("id,name").eq("active", true).order("sort_order"),
  ]);

  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Mi ruta</h1>
      <p className="mt-2 mb-6 max-w-2xl text-sm text-stone-600">Las clientas te pueden pedir si entregas en su municipio y recoges en un punto al que llega la vendedora.</p>
      <CourierRouteForm
        municipalities={courier?.municipalities ?? []}
        days={courier?.days ?? []}
        timeWindow={courier?.time_window ?? ""}
        pointIds={(myPoints ?? []).map((row) => row.point_id)}
        points={points ?? []}
      />
    </section>
  );
}
