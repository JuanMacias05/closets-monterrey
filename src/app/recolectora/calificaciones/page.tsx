import { requireCourier } from "@/features/couriers/require-courier";

export const metadata = { title: "Calificaciones | BZRS Monterrey" };

type Rated = { id: string; closed_at: string | null; courier_rating: number | null; buyer_municipality: string | null; seller: { store_name: string } | null };

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Monterrey" });

// The stars buyers gave her after each delivery. The average and count are the same numbers
// the public directory shows (courier_stats).
export default async function CourierRatingsPage() {
  const { viewer, supabase } = await requireCourier("/recolectora/calificaciones");
  const [{ data: rows }, { data: stats }] = await Promise.all([
    supabase.from("reservations")
      .select("id,closed_at,courier_rating,buyer_municipality,seller:profiles!reservations_seller_id_fkey(store_name)")
      .eq("courier_id", viewer.userId).eq("status", "completed")
      .order("closed_at", { ascending: false }).limit(100),
    supabase.rpc("courier_stats"),
  ]);
  const deliveries = (rows ?? []) as unknown as Rated[];
  const mine = ((stats ?? []) as { courier_id: string; deliveries: number; rating: number | null }[]).find((row) => row.courier_id === viewer.userId);
  const rated = deliveries.filter((delivery) => delivery.courier_rating !== null);

  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Calificaciones</h1>
      <div className="mt-6 flex flex-wrap gap-4">
        <div className="min-w-40 border border-stone-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-stone-600">Promedio</p>
          <p className="mt-1 font-serif text-3xl text-stone-900">{mine?.rating !== null && mine?.rating !== undefined ? <><span aria-hidden="true">★</span> {Number(mine.rating).toFixed(1)}</> : "—"}</p>
        </div>
        <div className="min-w-40 border border-stone-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-stone-600">Entregas hechas</p>
          <p className="mt-1 font-serif text-3xl text-stone-900">{mine?.deliveries ?? deliveries.length}</p>
        </div>
      </div>
      {rated.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">Todavía no tienes calificaciones. La clientela califica de 1 a 5 estrellas después de recibir.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
          {rated.map((delivery) => (
            <li key={delivery.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm text-stone-700">
              <span>{delivery.seller?.store_name ?? "Tienda"} → {delivery.buyer_municipality ?? "—"}{delivery.closed_at ? ` · ${dateFormat.format(new Date(delivery.closed_at))}` : ""}</span>
              <span aria-label={`${delivery.courier_rating} de 5 estrellas`} className="text-stone-900">{"★".repeat(delivery.courier_rating!)}<span className="text-stone-300">{"★".repeat(5 - delivery.courier_rating!)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
