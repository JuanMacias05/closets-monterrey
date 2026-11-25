import Link from "next/link";
import { redirect } from "next/navigation";
import { CourierCard } from "@/components/couriers/courier-card";
import { getCourierDirectory } from "@/features/couriers/directory";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Recolección | BZRS Monterrey" };

// The verified couriers who collect at the seller's own fixed points: the ones her buyers can
// pick at checkout. Verifying couriers is the admin's page (/panel/admin/recolectoras).
export default async function SellerCouriersPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: pointRows }, couriers] = await Promise.all([
    supabase.from("seller_delivery_points").select("point:delivery_points(id,name)").eq("seller_id", user.id),
    getCourierDirectory(),
  ]);
  const myPoints = ((pointRows ?? []) as unknown as { point: { id: string; name: string } | null }[]).flatMap((row) => (row.point ? [row.point] : []));
  const myPointIds = new Set(myPoints.map((point) => point.id));
  const atMyPoints = couriers.filter((courier) => courier.pointIds.some((id) => myPointIds.has(id)));

  return (
    <section>
      <div className="border-b border-stone-200 pb-5">
        <h1 className="font-serif text-3xl tracking-tight text-stone-900">Recolección</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Recolección verificada que recoge en tus puntos fijos. Tu clientela puede pedirle que le lleve su pedido; quien recolecta acepta o rechaza, y lo ves en Apartados.
        </p>
      </div>
      {myPoints.length === 0 ? (
        <p className="py-6 text-sm text-stone-600">
          Todavía no eliges puntos fijos. <Link href="/panel/tienda" className="text-pine underline underline-offset-4">Elige tus puntos en Mi bazar</Link> para que la recolección pueda llevarse tus pedidos.
        </p>
      ) : atMyPoints.length === 0 ? (
        <p className="py-6 text-sm text-stone-600">Nadie con recolección verificada recoge todavía en tus puntos ({myPoints.map((point) => point.name).join(", ")}).</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {atMyPoints.map((courier) => (
            <li key={courier.id} className="space-y-1">
              <CourierCard courier={courier} />
              <p className="px-1 text-xs text-stone-600">
                Recoge en tus puntos: {courier.pointIds.flatMap((id, index) => (myPointIds.has(id) ? [courier.pointNames[index]] : [])).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
