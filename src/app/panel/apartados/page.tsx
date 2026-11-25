import Link from "next/link";
import { redirect } from "next/navigation";
import { DeliveryFeeAdjust } from "@/app/panel/apartados/delivery-fee-adjust";
import { ProofReview } from "@/app/panel/apartados/proof-review";
import { ReservationActions } from "@/app/panel/apartados/reservation-actions";
import { ChatLink } from "@/components/chat/conversation-list";
import { ProofPurgedNote } from "@/components/shop/proof-purged-note";
import { conversationLinks } from "@/features/chat/chat-data";
import { canPayDeposit, courierDeliveryState, type CourierRequestRow } from "@/features/couriers/courier-requests";
import { formatPriceMXN } from "@/features/products/format-price";
import { RESERVATION_STATUS_LABELS, TRUST_LABELS, TRUST_STYLES } from "@/features/shop/reservation-labels";
import { deliveryFeeChange, deliveryGroup, sellerBalanceAtDelivery } from "@/features/shop/reservation-money";
import { proofReviewCutoff } from "@/features/support/support-contact";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Apartados | BZRS Monterrey" };

type ReservationRow = {
  id: string; buyer_id: string | null; status: string; items_total_mxn: number; deposit_percent: number; deposit_mxn: number;
  expires_at: string; created_at: string;
  delivery_method: string; delivery_address: string | null; delivery_fee_mxn: number; delivery_status: string;
  delivery_fee_estimate_mxn: number | null; delivery_origin_municipality: string | null; delivery_fee_adjusted_at: string | null;
  point: { name: string } | null;
  courier_fee_payment: string | null; courier_whatsapp: string | null; buyer_municipality: string | null;
  courier: { full_name: string } | null;
  courier_id: string | null; courier_accepted_at: string | null;
  requests: CourierRequestRow[] | null;
  items: { price_mxn: number; product: { name: string; slug: string } | null }[] | null;
  proof_path: string | null; proof_method: "transfer" | "oxxo" | null; proof_reference: string | null;
  proof_submitted_at: string | null; proof_rejected_at: string | null; proof_rejection_reason: string | null;
  proof_purged_at: string | null;
};

function underReview(reservation: ReservationRow) {
  return reservation.status === "pending_deposit" && reservation.proof_submitted_at !== null && reservation.proof_rejected_at === null;
}

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
    .select("id,buyer_id,status,items_total_mxn,deposit_percent,deposit_mxn,expires_at,created_at,delivery_method,delivery_address,delivery_fee_mxn,delivery_status,point:delivery_points(name),courier_fee_payment,courier_whatsapp,buyer_municipality,courier:couriers(full_name),courier_id,courier_accepted_at,requests:courier_requests(id,status,requested_at,expires_at,resolved_at,rejection_reason,courier_id,courier:couriers(full_name)),items:reservation_items(price_mxn,product:products(name,slug)),proof_path,proof_method,proof_reference,proof_submitted_at,proof_rejected_at,proof_rejection_reason,proof_purged_at,delivery_fee_estimate_mxn,delivery_origin_municipality,delivery_fee_adjusted_at")
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
  const proofPaths = reservations.filter(underReview).map((reservation) => reservation.proof_path).filter((path): path is string => Boolean(path));
  const { data: signed } = proofPaths.length ? await supabase.storage.from("payment-proofs").createSignedUrls(proofPaths, 60 * 30) : { data: [] };
  const proofUrlByPath = new Map((signed ?? []).filter((entry) => entry.path && entry.signedUrl).map((entry) => [entry.path!, entry.signedUrl]));
  const staleBefore = proofReviewCutoff();
  const lightById = new Map(lights);
  const chats = await conversationLinks("seller");

  // A proof waiting for review is the one thing that blocks a buyer, so those come first.
  const allOpen = reservations.filter((reservation) => OPEN.includes(reservation.status))
    .sort((a, b) => Number(underReview(b)) - Number(underReview(a)));
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
    const buyerName = buyer?.full_name ?? (reservation.buyer_id ? "Cliente" : "Cuenta borrada");
    return (
      <li key={reservation.id} className={`bg-white p-5 ${underReview(reservation) ? "border-2 border-pine" : "border border-stone-200"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-stone-900">{buyerName}</span>
            <span className={`px-2 py-0.5 font-condensed text-xs font-bold uppercase ${TRUST_STYLES[light] ?? ""}`}>{TRUST_LABELS[light] ?? light}</span>
          </p>
          <span className={`px-2 py-1 font-condensed text-sm font-bold uppercase ${underReview(reservation) ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-800"}`}>{underReview(reservation) ? "Revisar comprobante" : RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}</span>
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
            : reservation.delivery_method === "home_delivery" ? `A domicilio${reservation.buyer_municipality ? ` en ${reservation.buyer_municipality}` : ""} (envío ${formatPriceMXN(reservation.delivery_fee_mxn)}) · ${reservation.delivery_address ?? ""}`
            : reservation.delivery_method === "courier" ? `${reservation.courier?.full_name ?? "Recolección"} (recolección) la recoge contigo en un punto fijo y la lleva a ${reservation.buyer_municipality ?? ""}${reservation.courier_fee_payment === "with_deposit" ? `; su tarifa (${formatPriceMXN(reservation.delivery_fee_mxn)}) viene en el anticipo: págasela tú` : ""}`
            : "Acordar por WhatsApp"}
          {reservation.status === "confirmed" && reservation.delivery_status === "picked_up" && " · En recolección"}
          {reservation.status === "confirmed" && reservation.delivery_status === "on_the_way" && " · En camino"}
          {reservation.delivery_method === "courier" && reservation.courier_whatsapp && <> · <a href={`https://wa.me/${reservation.courier_whatsapp.replace("+", "")}`} className="text-pine underline underline-offset-4">WhatsApp de quien recolecta</a></>}
        </p>
        <DeliveryFeeNote reservation={reservation} />
        {reservation.status === "pending_deposit" && <CourierRequestNote reservation={reservation} />}
        {reservation.status === "pending_deposit" && !underReview(reservation) && canPayDeposit(reservation) && <p className="mt-1 text-sm text-stone-700">Se libera sola el {dateFormat.format(new Date(reservation.expires_at))} si no llega el anticipo.</p>}
        {reservation.status === "pending_deposit" && reservation.proof_rejected_at && (
          <p className="mt-2 bg-red-50 p-3 text-sm text-red-800">Rechazaste su comprobante: “{reservation.proof_rejection_reason}”. Tiene hasta el {dateFormat.format(new Date(reservation.expires_at))} para subir otro.</p>
        )}
        {reservation.proof_purged_at && <ProofPurgedNote purgedAt={reservation.proof_purged_at} />}
        {underReview(reservation) && <ProofToReview reservation={reservation} imageUrl={reservation.proof_path ? proofUrlByPath.get(reservation.proof_path) ?? null : null} stale={new Date(reservation.proof_submitted_at!).getTime() < staleBefore} buyerName={buyerName} />}
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <ReservationActions reservationId={reservation.id} status={reservation.status} deliveryStatus={reservation.delivery_status} buyerName={buyerName} canConfirm={canPayDeposit(reservation)} />
          {canAdjustDeliveryFee(reservation) && <DeliveryFeeAdjust reservationId={reservation.id} feeMxn={reservation.delivery_fee_mxn} buyerName={buyerName} />}
          {underReview(reservation) && <ProofReview reservationId={reservation.id} buyerName={buyerName} />}
        </div>
        {(chats.get(reservation.id)?.order || chats.get(reservation.id)?.pickup) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chats.get(reservation.id)?.order && <ChatLink href={`/cuenta/mensajes/${chats.get(reservation.id)!.order!.id}`} label={`Mensajes con ${buyer?.full_name ?? "tu cliente"}`} unread={chats.get(reservation.id)!.order!.unread} />}
            {chats.get(reservation.id)?.pickup && <ChatLink href={`/cuenta/mensajes/${chats.get(reservation.id)!.pickup!.id}`} label="Mensajes con quien recolecta" unread={chats.get(reservation.id)!.pickup!.unread} />}
          </div>
        )}
      </li>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-5">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">Apartados</h1>
          <p className="mt-2 text-sm text-stone-600">Revisa cada comprobante en tu banco antes de confirmar el anticipo, y marca la entrega cuando cobres el resto.</p>
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
      {open.length === 0 ? <p className="py-6 text-sm text-stone-600">{activeGroup ? "No hay apartados abiertos con esta entrega." : "No tienes apartados abiertos. Cuando alguien aparte una de tus prendas, aparece aquí para que confirmes su anticipo."}</p> : <ul className="mt-5 space-y-4">{open.map(renderReservation)}</ul>}
      {closed.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer py-3 text-sm font-medium text-stone-700">Historial ({closed.length})</summary>
          <ul className="mt-3 space-y-4">{closed.map(renderReservation)}</ul>
        </details>
      )}
    </section>
  );
}

// Same rule as adjust_delivery_fee: home delivery, still waiting for the deposit, and the buyer
// hasn't sent a proof (once she says she paid, the price she saw stands).
function canAdjustDeliveryFee(reservation: ReservationRow) {
  return reservation.delivery_method === "home_delivery" && reservation.status === "pending_deposit" && reservation.proof_submitted_at === null;
}

function DeliveryFeeNote({ reservation }: { reservation: ReservationRow }) {
  if (reservation.delivery_method !== "home_delivery") return null;
  const change = deliveryFeeChange(reservation);
  if (change) {
    return <p className="mt-1 text-sm text-stone-700">Ajustaste el envío de {formatPriceMXN(change.fromMxn)} a {formatPriceMXN(change.toMxn)}.</p>;
  }
  if (canAdjustDeliveryFee(reservation) && reservation.delivery_fee_estimate_mxn !== null) {
    return (
      <p className="mt-1 text-sm text-stone-700">
        Envío estimado{reservation.delivery_origin_municipality && reservation.buyer_municipality ? ` de ${reservation.delivery_origin_municipality} a ${reservation.buyer_municipality}` : ""} con las tarifas de BZRS Monterrey. Si su dirección queda lejos, ajústalo antes de que te pague el anticipo.
      </p>
    );
  }
  return null;
}

// Who has (or was asked for) the courier delivery, and whether the buyer can pay yet: the
// seller can't confirm a deposit until the courier accepts (update_reservation refuses it).
function CourierRequestNote({ reservation }: { reservation: ReservationRow }) {
  const state = courierDeliveryState(reservation, reservation.requests);
  if (state.kind === "none") return null;
  const name = state.request?.courier?.full_name ?? reservation.courier?.full_name ?? "Quien recolecta";
  if (state.kind === "accepted") {
    return <p className="mt-1 text-sm text-pine" data-testid="courier-status">✓ {name} aceptó la entrega.</p>;
  }
  if (state.kind === "waiting") {
    return (
      <p className="mt-2 bg-stone-100 p-3 text-sm text-stone-800" data-testid="courier-status">
        Esperando a que <strong>{name}</strong> acepte la entrega{state.request ? ` (responde a más tardar ${dateFormat.format(new Date(state.request.expires_at))})` : ""}. Tu cliente paga su anticipo hasta que acepte; las prendas siguen apartadas.
      </p>
    );
  }
  return (
    <p className="mt-2 bg-amber-50 p-3 text-sm text-amber-900" data-testid="courier-status">
      {name} {state.request?.status === "expired" ? "no respondió a tiempo" : "no aceptó"}. Tu cliente está eligiendo otra entrega; tiene hasta {dateFormat.format(new Date(reservation.expires_at))} o las prendas se liberan.
    </p>
  );
}

function GroupChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center border px-3 text-sm ${active ? "border-pine bg-pine text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-600"}`}>
      {children}
    </Link>
  );
}

// IMPORTANT: a photo can be edited; the bank can't. The copy always sends the seller to her bank
// before she confirms, and offers Banxico's CEP for transfers that carry a tracking key.
function ProofToReview({ reservation, imageUrl, stale, buyerName }: { reservation: ReservationRow; imageUrl: string | null; stale: boolean; buyerName: string }) {
  const oxxo = reservation.proof_method === "oxxo";
  return (
    <div className="mt-3 space-y-3">
      {stale && <p className="bg-red-50 p-3 text-sm text-red-800"><strong>{buyerName} subió su comprobante hace más de 48 horas.</strong> Revísalo hoy; si no, lo revisa soporte.</p>}
      <div className="flex flex-wrap items-start gap-4">
        {imageUrl && (
          <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Ver comprobante completo">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private file */}
            <img src={imageUrl} alt={`Comprobante de ${buyerName}`} className="h-36 w-28 border border-stone-200 object-cover" />
          </a>
        )}
        <div className="min-w-0 space-y-1 text-sm text-stone-700">
          <p><strong className="text-stone-900">{oxxo ? "Pagó en efectivo en OXXO" : "Pagó por transferencia"}</strong> · {formatPriceMXN(reservation.deposit_mxn)}</p>
          <p>Subido el {dateFormat.format(new Date(reservation.proof_submitted_at!))}</p>
          {reservation.proof_reference && <p>{oxxo ? "Folio del ticket" : "Clave de rastreo"}: <span className="font-mono text-stone-900">{reservation.proof_reference}</span></p>}
          {!oxxo && <p><a href="https://www.banxico.org.mx/cep/" target="_blank" rel="noopener noreferrer" className="text-pine underline underline-offset-4">Verificar la transferencia en Banxico (CEP)</a></p>}
          {imageUrl && <p><a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-pine underline underline-offset-4">Ver foto completa</a></p>}
        </div>
      </div>
      <p className="bg-amber-50 p-3 text-sm text-amber-900"><strong>Confirma solo si ya ves {formatPriceMXN(reservation.deposit_mxn)} en tu banco.</strong> Una foto se puede editar; tu banco no.{oxxo ? " Los depósitos en OXXO pueden tardar unos minutos en reflejarse." : ""}</p>
    </div>
  );
}
