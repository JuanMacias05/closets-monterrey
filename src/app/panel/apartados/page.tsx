import Link from "next/link";
import { redirect } from "next/navigation";
import { ReservationActions } from "@/app/panel/apartados/reservation-actions";
import { formatPriceMXN } from "@/features/products/format-price";
import { RESERVATION_STATUS_LABELS, TRUST_LABELS, TRUST_STYLES } from "@/features/shop/reservation-labels";
import { deliveryGroup, sellerBalanceAtDelivery } from "@/features/shop/reservation-money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Apartados | Closets Monterrey" };

type ReservationRow = {
  id: string; buyer_id: string | null; status: string; items_total_mxn: number; deposit_percent: number; deposit_mxn: number;
  expires_at: string; created_at: string;
  delivery_method: string; delivery_address: string | null; delivery_fee_mxn: number; delivery_status: string;
  point: { name: string } | null;
  courier_fee_payment: string | null; courier_whatsapp: string | null; buyer_municipality: string | null;
  courier: { full_name: string } | null;
  items: { price_mxn: number; product: { name: string; slug: string } | null }[] | null;
};

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Monterrey" });
const OPEN = ["pending_deposit", "confirmed"];

export default async function SellerReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const groupParam = (await searchParams).entrega;
  const activeGroup = typeof groupParam === "string" ? groupParam : undefined;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("release_expired_reservations");
  const { data: rows, error } = await supabase.from("reservations")
    .select("id,buyer_id,status,items_total_mxn,deposit_percent,deposit_mxn,expires_at,created_at,delivery_method,delivery_address,delivery_fee_mxn,delivery_status,point:delivery_points(name),courier_fee_payment,courier_whatsapp,buyer_municipality,courier:couriers(full_name),items:reservation_items(price_mxn,product:products(name,slug))")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("No pudimos cargar tus apartados.");
  const reservations = (rows ?? []) as unknown as ReservationRow[];

  // Buyers aren't joinable from reservations (buyer_id points at auth.users), so they and
  // their trust lights load in a second step.
  // buyer_id is null once a shopper deleted her account; the sale stays, anonymous.
  const buyerIds = [...new Set(reservations.map((reservation) => reservation.buyer_id).filter((id): id is string => id !== null))];
  const [{ data: buyers }, lights] = await Promise.all([
    buyerIds.length ? supabase.from("buyer_profiles").select("id,full_name,facebook_url,phone_e164").in("id", buyerIds) : Promise.resolve({ data: [] }),
    Promise.all(buyerIds.map(async (id) => [id, (await supabase.rpc("buyer_trust_light", { target: id })).data as string | null] as const)),
  ]);
  const buyerById = new Map((buyers ?? []).map((buyer) => [buyer.id, buyer]));
  const lightById = new Map(lights);

  const allOpen = reservations.filter((reservation) => OPEN.includes(reservation.status));
  // Group chips count open reservations only: they're for planning today's hand-offs, so a
  // closed one at Padre Mier must not make Padre Mier look busy.
  const groups = new Map<string, { label: string; count: number }>();
  for (const reservation of allOpen) {
    const { key, label } = deliveryGroup(reservation);
    groups.set(key, { label, count: (groups.get(key)?.count ?? 0) + 1 });
  }
  const open = activeGroup ? allOpen.filter((reservation) => deliveryGroup(reservation).key === activeGroup) : allOpen;
  const closed = reservations.filter((reservation) => !OPEN.includes(reservation.status));

  function renderReservation(reservation: ReservationRow) {
    const buyer = reservation.buyer_id ? buyerById.get(reservation.buyer_id) : undefined;
    const light = (reservation.buyer_id && lightById.get(reservation.buyer_id)) || "new";
    const buyerName = buyer?.full_name ?? (reservation.buyer_id ? "Compradora" : "Cuenta borrada");
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
        {OPEN.includes(reservation.status) && (
          <p className="mt-1 text-sm text-stone-700">Cobras en la entrega: <strong className="text-stone-900" data-testid="seller-balance">{formatPriceMXN(sellerBalanceAtDelivery(reservation))}</strong></p>
        )}
        <p className="mt-1 text-sm text-stone-700">
          <strong>Entrega:</strong>{" "}
          {reservation.delivery_method === "pickup_point" ? `Punto fijo · ${reservation.point?.name ?? ""}`
            : reservation.delivery_method === "home_delivery" ? `A domicilio (${formatPriceMXN(reservation.delivery_fee_mxn)}) · ${reservation.delivery_address ?? ""}`
            : reservation.delivery_method === "courier" ? `Recolectora ${reservation.courier?.full_name ?? ""} la recoge contigo en un punto fijo y la lleva a ${reservation.buyer_municipality ?? ""}${reservation.courier_fee_payment === "with_deposit" ? `; su tarifa (${formatPriceMXN(reservation.delivery_fee_mxn)}) viene en el anticipo: págasela tú` : ""}`
            : "Acordar por WhatsApp"}
          {reservation.status === "confirmed" && reservation.delivery_status === "picked_up" && " · Con la recolectora"}
          {reservation.status === "confirmed" && reservation.delivery_status === "on_the_way" && " · En camino"}
          {reservation.delivery_method === "courier" && reservation.courier_whatsapp && <> · <a href={`https://wa.me/${reservation.courier_whatsapp.replace("+", "")}`} className="text-pine underline underline-offset-4">WhatsApp de la recolectora</a></>}
        </p>
        {reservation.status === "pending_deposit" && <p className="mt-1 text-sm text-stone-700">Se libera sola el {dateFormat.format(new Date(reservation.expires_at))} si no llega el anticipo.</p>}
        <div className="mt-4"><ReservationActions reservationId={reservation.id} status={reservation.status} deliveryStatus={reservation.delivery_status} buyerName={buyerName} /></div>
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
      </div>
      {groups.size > 1 && (
        <nav aria-label="Filtrar por entrega" className="mt-5 flex flex-wrap gap-2">
          <GroupChip href="/panel/apartados" active={!activeGroup}>Todas ({allOpen.length})</GroupChip>
          {[...groups].map(([key, group]) => (
            <GroupChip key={key} href={`/panel/apartados?entrega=${encodeURIComponent(key)}`} active={activeGroup === key}>{group.label} ({group.count})</GroupChip>
          ))}
        </nav>
      )}
      {open.length === 0 ? <p className="py-6 text-sm text-stone-600">{activeGroup ? "No hay apartados abiertos con esta entrega." : "No tienes apartados abiertos."}</p> : <ul className="mt-5 space-y-4">{open.map(renderReservation)}</ul>}
      {closed.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer py-3 text-sm font-medium text-stone-700">Historial ({closed.length})</summary>
          <ul className="mt-3 space-y-4">{closed.map(renderReservation)}</ul>
        </details>
      )}
    </section>
  );
}

function GroupChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center border px-3 text-sm ${active ? "border-pine bg-pine text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-600"}`}>
      {children}
    </Link>
  );
}
