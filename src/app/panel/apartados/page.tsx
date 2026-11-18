import Link from "next/link";
import { redirect } from "next/navigation";
import { ReservationActions } from "@/app/panel/apartados/reservation-actions";
import { formatPriceMXN } from "@/features/products/format-price";
import { RESERVATION_STATUS_LABELS, TRUST_LABELS, TRUST_STYLES } from "@/features/shop/reservation-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Apartados | Closets Monterrey" };

type ReservationRow = {
  id: string; buyer_id: string; status: string; items_total_mxn: number; deposit_percent: number; deposit_mxn: number;
  expires_at: string; created_at: string;
  items: { price_mxn: number; product: { name: string; slug: string } | null }[] | null;
};

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Monterrey" });
const OPEN = ["pending_deposit", "confirmed"];

export default async function SellerReservationsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("release_expired_reservations");
  const { data: rows, error } = await supabase.from("reservations")
    .select("id,buyer_id,status,items_total_mxn,deposit_percent,deposit_mxn,expires_at,created_at,items:reservation_items(price_mxn,product:products(name,slug))")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("No pudimos cargar tus apartados.");
  const reservations = (rows ?? []) as unknown as ReservationRow[];

  // Buyers aren't joinable from reservations (buyer_id points at auth.users), so they and
  // their trust lights load in a second step.
  const buyerIds = [...new Set(reservations.map((reservation) => reservation.buyer_id))];
  const [{ data: buyers }, lights] = await Promise.all([
    buyerIds.length ? supabase.from("buyer_profiles").select("id,full_name,facebook_url,phone_e164").in("id", buyerIds) : Promise.resolve({ data: [] }),
    Promise.all(buyerIds.map(async (id) => [id, (await supabase.rpc("buyer_trust_light", { target: id })).data as string | null] as const)),
  ]);
  const buyerById = new Map((buyers ?? []).map((buyer) => [buyer.id, buyer]));
  const lightById = new Map(lights);

  const open = reservations.filter((reservation) => OPEN.includes(reservation.status));
  const closed = reservations.filter((reservation) => !OPEN.includes(reservation.status));

  function renderReservation(reservation: ReservationRow) {
    const buyer = buyerById.get(reservation.buyer_id);
    const light = lightById.get(reservation.buyer_id) ?? "new";
    const buyerName = buyer?.full_name ?? "Compradora";
    return (
      <li key={reservation.id} className="border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-stone-900">{buyerName}</span>
            <span className={`px-2 py-0.5 font-condensed text-xs font-bold uppercase ${TRUST_STYLES[light] ?? ""}`}>{TRUST_LABELS[light] ?? light}</span>
          </p>
          <span className="bg-stone-100 px-2 py-1 font-condensed text-sm font-bold uppercase text-stone-800">{RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}</span>
        </div>
        {buyer && (
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
            <a href={buyer.facebook_url} target="_blank" rel="noopener noreferrer" className="text-pine underline underline-offset-4">Ver su Facebook</a>
            {buyer.phone_e164 && <a href={`https://wa.me/${buyer.phone_e164.replace("+", "")}`} className="text-pine underline underline-offset-4">WhatsApp {buyer.phone_e164}</a>}
          </p>
        )}
        <ul className="mt-3 text-sm text-stone-700">
          {(reservation.items ?? []).map((item, index) => (
            <li key={index}>{item.product?.name ?? "Prenda"} · {formatPriceMXN(item.price_mxn)}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-stone-700">Total {formatPriceMXN(reservation.items_total_mxn)} · anticipo {reservation.deposit_percent} %: <strong className="text-stone-900">{formatPriceMXN(reservation.deposit_mxn)}</strong></p>
        {reservation.status === "pending_deposit" && <p className="mt-1 text-sm text-stone-700">Se libera sola el {dateFormat.format(new Date(reservation.expires_at))} si no llega el anticipo.</p>}
        <div className="mt-4"><ReservationActions reservationId={reservation.id} status={reservation.status} buyerName={buyerName} /></div>
      </li>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-5">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">Apartados</h1>
          <p className="mt-2 text-sm text-stone-600">Confirma el anticipo cuando lo veas en tu banco y marca la entrega cuando cobres el resto.</p>
        </div>
        <Link href="/panel" className="flex min-h-11 items-center text-sm text-stone-700 underline underline-offset-4">Volver al panel</Link>
      </div>
      {open.length === 0 ? <p className="py-6 text-sm text-stone-600">No tienes apartados abiertos.</p> : <ul className="mt-5 space-y-4">{open.map(renderReservation)}</ul>}
      {closed.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer py-3 text-sm font-medium text-stone-700">Historial ({closed.length})</summary>
          <ul className="mt-3 space-y-4">{closed.map(renderReservation)}</ul>
        </details>
      )}
    </section>
  );
}
