import { redirect } from "next/navigation";
import { CourierDeliveryActions } from "@/app/recolectora/delivery-actions";
import { CourierProfileForm } from "@/app/recolectora/courier-profile-form";
import { StoreHeader } from "@/components/store/store-header";
import { formatPriceMXN } from "@/features/products/format-price";
import { getViewer } from "@/features/viewer/get-viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Mis entregas | Closets Monterrey" };

type Assignment = {
  id: string; buyer_id: string; delivery_status: string; delivery_address: string | null; buyer_municipality: string | null;
  delivery_fee_mxn: number; courier_fee_payment: string | null; seller_whatsapp: string | null;
  seller: { store_name: string } | null;
  items: { product: { name: string } | null }[] | null;
};

const STEP_LABELS: Record<string, string> = { preparing: "Por recoger", picked_up: "Contigo", on_the_way: "En camino" };

// The courier's own area: her route (where she collects, where she delivers, days, fee)
// and the confirmed reservations assigned to her.
export default async function CourierPage() {
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect("/login?next=/recolectora");
  if (viewer.kind !== "courier") redirect("/");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");

  const [{ data: courier }, { data: myPoints }, { data: points }, { data: rows }] = await Promise.all([
    supabase.from("couriers").select("municipalities,days,time_window,fee_mxn,status").eq("id", viewer.userId).single(),
    supabase.from("courier_pickup_points").select("point_id").eq("courier_id", viewer.userId),
    supabase.from("delivery_points").select("id,name").eq("active", true).order("sort_order"),
    supabase.from("reservations")
      .select("id,buyer_id,delivery_status,delivery_address,buyer_municipality,delivery_fee_mxn,courier_fee_payment,seller_whatsapp,seller:profiles!reservations_seller_id_fkey(store_name),items:reservation_items(product:products(name))")
      .eq("courier_id", viewer.userId).eq("status", "confirmed")
      .order("created_at", { ascending: true }),
  ]);
  const assignments = (rows ?? []) as unknown as Assignment[];
  const buyerIds = [...new Set(assignments.map((a) => a.buyer_id))];
  const { data: buyers } = buyerIds.length
    ? await supabase.from("buyer_profiles").select("id,full_name,phone_e164").in("id", buyerIds)
    : { data: [] };
  const buyerById = new Map((buyers ?? []).map((buyer) => [buyer.id, buyer]));

  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-16 pt-8 sm:px-8">
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900 sm:text-5xl">Mis entregas</h1>
        {courier?.status === "pending" && (
          <p role="status" className="mt-4 border border-amber-700 bg-amber-50 p-4 text-sm text-stone-800">Tu cuenta está en revisión. La administración te verificará en persona; mientras tanto, llena tu ruta para aparecer en cuanto te aprueben.</p>
        )}
        {courier?.status === "suspended" && (
          <p role="alert" className="mt-4 border border-[#a3261b] p-4 text-sm text-[#a3261b]">Tu cuenta está suspendida. Comunícate con la administración.</p>
        )}
        {courier?.status === "approved" && <p className="mt-3 inline-block bg-pine px-2 py-1 font-condensed text-sm font-bold uppercase text-white">✓ Recolectora verificada</p>}

        <section className="mt-8" aria-labelledby="entregas">
          <h2 id="entregas" className="font-condensed text-2xl font-bold uppercase text-stone-900">Entregas asignadas</h2>
          {assignments.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">No tienes entregas por ahora. Te aparecen aquí cuando la vendedora confirma el anticipo.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {assignments.map((assignment) => {
                const buyer = buyerById.get(assignment.buyer_id);
                return (
                  <li key={assignment.id} className="border border-stone-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-stone-900">Para {buyer?.full_name ?? "la clienta"} · {assignment.buyer_municipality}</p>
                      <span className="bg-stone-100 px-2 py-1 font-condensed text-sm font-bold uppercase text-stone-800">{STEP_LABELS[assignment.delivery_status] ?? assignment.delivery_status}</span>
                    </div>
                    <p className="mt-2 text-sm text-stone-700"><strong>Recoges con:</strong> {assignment.seller?.store_name ?? "la vendedora"}{assignment.seller_whatsapp && <> · <a href={`https://wa.me/${assignment.seller_whatsapp.replace("+", "")}`} className="text-pine underline underline-offset-4">WhatsApp</a></>}</p>
                    <p className="text-sm text-stone-700"><strong>Entregas en:</strong> {assignment.delivery_address}{buyer?.phone_e164 && <> · <a href={`https://wa.me/${buyer.phone_e164.replace("+", "")}`} className="text-pine underline underline-offset-4">WhatsApp de la clienta</a></>}</p>
                    <p className="text-sm text-stone-700"><strong>Prendas:</strong> {(assignment.items ?? []).map((item) => item.product?.name ?? "Prenda").join(", ")}</p>
                    <p className="text-sm text-stone-700"><strong>Tu tarifa:</strong> {formatPriceMXN(assignment.delivery_fee_mxn)} · {assignment.courier_fee_payment === "with_deposit" ? "te la paga la vendedora" : "te la paga la clienta al recibir"}</p>
                    <div className="mt-4"><CourierDeliveryActions reservationId={assignment.id} deliveryStatus={assignment.delivery_status} buyerName={buyer?.full_name ?? "La clienta"} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-12 border-t border-stone-200 pt-8" aria-labelledby="ruta">
          <h2 id="ruta" className="font-condensed text-2xl font-bold uppercase text-stone-900">Mi ruta</h2>
          <p className="mt-1 mb-5 text-sm text-stone-600">Las clientas te ven si entregas en su municipio y recoges en un punto al que llega la vendedora.</p>
          <CourierProfileForm
            municipalities={courier?.municipalities ?? []}
            days={courier?.days ?? []}
            timeWindow={courier?.time_window ?? ""}
            feeMxn={courier?.fee_mxn ?? 0}
            pointIds={(myPoints ?? []).map((row) => row.point_id)}
            points={points ?? []}
          />
        </section>
      </main>
    </>
  );
}
