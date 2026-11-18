import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreHeader } from "@/components/store/store-header";
import { BuyerProfileForm } from "@/components/shop/buyer-profile-form";
import { CancelReservationButton } from "@/components/shop/cancel-reservation-button";
import { formatPriceMXN } from "@/features/products/format-price";
import { DELIVERY_STATUS_STEPS, RESERVATION_STATUS_LABELS } from "@/features/shop/reservation-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Mi cuenta | Closets Monterrey" };

type ReservationRow = {
  id: string; status: string; items_total_mxn: number; deposit_percent: number; deposit_mxn: number;
  deposit_clabe: string; seller_whatsapp: string | null; expires_at: string; created_at: string;
  delivery_method: string; delivery_address: string | null; delivery_fee_mxn: number; delivery_status: string;
  point: { name: string } | null;
  seller: { store_name: string } | null;
  items: { price_mxn: number; product: { name: string; slug: string } | null }[] | null;
};

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Monterrey" });

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta");

  await supabase.rpc("release_expired_reservations");
  const [{ data: buyer }, { data: rows }] = await Promise.all([
    supabase.from("buyer_profiles").select("full_name,facebook_url").eq("id", user.id).maybeSingle(),
    supabase.from("reservations")
      .select("id,status,items_total_mxn,deposit_percent,deposit_mxn,deposit_clabe,seller_whatsapp,expires_at,created_at,delivery_method,delivery_address,delivery_fee_mxn,delivery_status,point:delivery_points(name),seller:profiles!reservations_seller_id_fkey(store_name),items:reservation_items(price_mxn,product:products(name,slug))")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const reservations = (rows ?? []) as unknown as ReservationRow[];
  // The PIN column is hidden from table reads (sellers must not see it); the buyer gets it
  // through a function that only answers for her own reservations.
  const pins = new Map(await Promise.all(
    reservations.filter((reservation) => reservation.status === "confirmed").map(async (reservation) =>
      [reservation.id, (await supabase.rpc("reservation_delivery_pin", { target: reservation.id })).data as string | null] as const),
  ));

  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-16 pt-8 sm:px-8">
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900 sm:text-5xl">Mi cuenta</h1>
        <nav aria-label="Mi cuenta" className="mt-4 flex gap-6 text-sm">
          <Link href="/favoritos" className="flex min-h-11 items-center text-pine underline underline-offset-4">Mis favoritos</Link>
          <Link href="/carrito" className="flex min-h-11 items-center text-pine underline underline-offset-4">Mi carrito</Link>
        </nav>

        <section className="mt-8" aria-labelledby="apartados">
          <h2 id="apartados" className="font-condensed text-2xl font-bold uppercase text-stone-900">Mis apartados</h2>
          {reservations.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">Todavía no apartas prendas. Arma tu carrito y dale &ldquo;Apartar&rdquo;.</p>
          ) : (
            <ul className="mt-4 space-y-5">
              {reservations.map((reservation) => {
                const pending = reservation.status === "pending_deposit";
                return (
                  <li key={reservation.id} id={`apartado-${reservation.id}`} className={`border p-5 ${pending ? "border-pine border-2" : "border-stone-200"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-stone-900">{reservation.seller?.store_name ?? "Vendedora"}</p>
                      <span className="bg-stone-100 px-2 py-1 font-condensed text-sm font-bold uppercase text-stone-800">{RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}</span>
                    </div>
                    <ul className="mt-2 text-sm text-stone-700">
                      {(reservation.items ?? []).map((item, index) => (
                        <li key={index}>{item.product ? <Link href={`/prendas/${item.product.slug}`} className="hover:underline">{item.product.name}</Link> : "Prenda"} · {formatPriceMXN(item.price_mxn)}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm text-stone-700">
                      <strong>Entrega:</strong>{" "}
                      {reservation.delivery_method === "pickup_point" ? `Punto fijo · ${reservation.point?.name ?? ""}`
                        : reservation.delivery_method === "home_delivery" ? `A domicilio · ${reservation.delivery_address ?? ""} (envío ${formatPriceMXN(reservation.delivery_fee_mxn)}, se paga al recibir)`
                        : "La acuerdas con la vendedora por WhatsApp"}
                    </p>
                    {!["expired", "cancelled", "no_show"].includes(reservation.status) && <TrackingSteps current={trackingStep(reservation)} />}
                    <p className="mt-2 text-sm text-stone-700">Total {formatPriceMXN(reservation.items_total_mxn)} · anticipo {reservation.deposit_percent} %: <strong className="text-stone-900">{formatPriceMXN(reservation.deposit_mxn)}</strong></p>

                    {pending && (
                      <div className="mt-4 bg-stone-100 p-4 text-sm text-stone-800">
                        <p className="font-semibold">Transfiere {formatPriceMXN(reservation.deposit_mxn)} a esta CLABE:</p>
                        <p className="mt-1 select-all font-mono text-lg tracking-wider text-stone-900">{reservation.deposit_clabe}</p>
                        <p className="mt-2">Tienes hasta el <strong>{dateFormat.format(new Date(reservation.expires_at))}</strong>. Si no llega el anticipo, las prendas se liberan.</p>
                        {reservation.seller_whatsapp && <p className="mt-2">Manda tu comprobante a la vendedora por WhatsApp: <a href={`https://wa.me/${reservation.seller_whatsapp.replace("+", "")}`} className="text-pine underline underline-offset-4">{reservation.seller_whatsapp}</a></p>}
                        <div className="mt-3"><CancelReservationButton reservationId={reservation.id} /></div>
                      </div>
                    )}
                    {reservation.status === "confirmed" && pins.get(reservation.id) && (
                      <div className="mt-4 border-2 border-pine p-4 text-center">
                        <p className="text-sm text-stone-700">Tu código de entrega</p>
                        <p className="mt-1 font-mono text-3xl tracking-[0.4em] text-stone-900" aria-label={`Código de entrega ${pins.get(reservation.id)!.split("").join(" ")}`}>{pins.get(reservation.id)}</p>
                        <p className="mt-1 text-xs text-stone-600">Dáselo a quien te entregue <strong>solo cuando tengas tus prendas</strong>. Con él se marca como entregada.</p>
                      </div>
                    )}
                    {reservation.status === "confirmed" && reservation.seller_whatsapp && (
                      <p className="mt-3 text-sm text-stone-700">La vendedora confirmó tu anticipo. Acuerden la entrega por WhatsApp: <a href={`https://wa.me/${reservation.seller_whatsapp.replace("+", "")}`} className="text-pine underline underline-offset-4">{reservation.seller_whatsapp}</a>. El resto se paga en la entrega.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-12 border-t border-stone-200 pt-8" aria-labelledby="mis-datos">
          <h2 id="mis-datos" className="font-condensed text-2xl font-bold uppercase text-stone-900">Mis datos</h2>
          <p className="mt-1 mb-4 text-sm text-stone-600">Las vendedoras ven tu nombre, tu Facebook y tu celular solo cuando les apartas.</p>
          <BuyerProfileForm fullName={buyer?.full_name ?? ""} facebookUrl={buyer?.facebook_url ?? ""} />
        </section>
      </main>
    </>
  );
}

function trackingStep(reservation: ReservationRow): number {
  if (reservation.status === "completed") return 3;
  if (reservation.status === "confirmed") return reservation.delivery_status === "on_the_way" ? 2 : 1;
  return 0;
}

function TrackingSteps({ current }: { current: number }) {
  return (
    <ol aria-label="Seguimiento" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {DELIVERY_STATUS_STEPS.map((step, index) => (
        <li key={step.value} aria-current={index === current ? "step" : undefined} className="flex items-center gap-2">
          <span className={`px-2 py-1 font-condensed font-bold uppercase ${index < current ? "bg-stone-200 text-stone-700" : index === current ? "bg-pine text-white" : "border border-stone-300 text-stone-500"}`}>{step.label}</span>
          {index < DELIVERY_STATUS_STEPS.length - 1 && <span aria-hidden="true" className="text-stone-400">→</span>}
        </li>
      ))}
    </ol>
  );
}
