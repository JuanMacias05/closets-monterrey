import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreHeader } from "@/components/store/store-header";
import { BuyerProfileForm } from "@/components/shop/buyer-profile-form";
import { CancelReservationButton } from "@/components/shop/cancel-reservation-button";
import { ChatLink } from "@/components/chat/conversation-list";
import { NotificationsToggle } from "@/components/push/notifications-toggle";
import { ChangeDeliveryForm } from "@/components/shop/change-delivery-form";
import { DeleteAccountButton } from "@/components/shop/delete-account-button";
import { DepositPayment } from "@/components/shop/deposit-payment";
import { ProofPurgedNote } from "@/components/shop/proof-purged-note";
import { SupportRequestForm } from "@/components/shop/support-request-form";
import { RateCourier } from "@/components/shop/rate-courier";
import {
  buyerCourierNotice,
  canPayDeposit,
  courierDeliveryState,
  courierRequestsLeft,
  declinedCourierIds,
  type CourierDeliveryState,
  type CourierNotice,
  type CourierRequestRow,
} from "@/features/couriers/courier-requests";
import { conversationLinks } from "@/features/chat/chat-data";
import { formatPriceMXN } from "@/features/products/format-price";
import { getSellerDeliveryOptions } from "@/features/shop/seller-delivery-options";
import { DELIVERY_STATUS_STEPS, RESERVATION_STATUS_LABELS } from "@/features/shop/reservation-labels";
import { deliveryFeeChange } from "@/features/shop/reservation-money";
import { reservationNoticeMessage, whatsappLink } from "@/features/shop/whatsapp-message";
import { proofReviewCutoff } from "@/features/support/support-contact";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Mi cuenta | Closets Monterrey" };

type ReservationRow = {
  id: string; status: string; items_total_mxn: number; deposit_percent: number; deposit_mxn: number;
  deposit_clabe: string; seller_whatsapp: string | null; expires_at: string; created_at: string;
  delivery_method: string; delivery_address: string | null; delivery_fee_mxn: number; delivery_status: string;
  delivery_fee_estimate_mxn: number | null; delivery_fee_adjusted_at: string | null;
  point: { name: string } | null;
  courier_fee_payment: string | null; courier_whatsapp: string | null; buyer_municipality: string | null; courier_rating: number | null;
  courier: { full_name: string } | null;
  courier_id: string | null; courier_accepted_at: string | null;
  requests: CourierRequestRow[] | null;
  seller: { id: string; store_name: string; home_delivery_enabled: boolean; home_delivery_origin: string | null; home_delivery_note: string | null } | null;
  items: { price_mxn: number; product: { name: string; slug: string } | null }[] | null;
  deposit_oxxo_card: string | null; proof_path: string | null; proof_method: "transfer" | "oxxo" | null; proof_reference: string | null;
  proof_submitted_at: string | null; proof_rejected_at: string | null; proof_rejection_reason: string | null;
  proof_purged_at: string | null;
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
      .select("id,status,items_total_mxn,deposit_percent,deposit_mxn,deposit_clabe,seller_whatsapp,expires_at,created_at,delivery_method,delivery_address,delivery_fee_mxn,delivery_status,point:delivery_points(name),courier_fee_payment,courier_whatsapp,buyer_municipality,courier_rating,courier:couriers(full_name),courier_id,courier_accepted_at,requests:courier_requests(id,status,requested_at,expires_at,resolved_at,rejection_reason,courier_id,courier:couriers(full_name)),seller:profiles!reservations_seller_id_fkey(id,store_name,home_delivery_enabled,home_delivery_origin,home_delivery_note),items:reservation_items(price_mxn,product:products(name,slug)),deposit_oxxo_card,proof_path,proof_method,proof_reference,proof_submitted_at,proof_rejected_at,proof_rejection_reason,proof_purged_at,delivery_fee_estimate_mxn,delivery_fee_adjusted_at")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const reservations = (rows ?? []) as unknown as ReservationRow[];
  // Courier requests (20261124000100): while one waits, or after a no, she can't pay yet and
  // may choose another delivery, so those reservations need their seller's delivery options.
  const courierStates = new Map(reservations.map((reservation) => [reservation.id, courierDeliveryState(reservation, reservation.requests)] as const));
  const choosing = reservations.filter((reservation) => reservation.status === "pending_deposit" && !canPayDeposit(reservation) && reservation.seller);
  const deliveryOptions = await getSellerDeliveryOptions(choosing.map((reservation) => reservation.seller!));
  const notices = reservations.flatMap((reservation) => {
    if (reservation.status !== "pending_deposit") return [];
    const notice = courierNotice(courierStates.get(reservation.id)!, reservation);
    return notice ? [{ reservation, notice }] : [];
  });
  // Proofs live in private storage; the buyer sees hers through short-lived signed URLs.
  const proofPaths = reservations.map((reservation) => reservation.proof_path).filter((path): path is string => Boolean(path));
  const [{ data: signed }, { data: openRequests }] = await Promise.all([
    proofPaths.length ? supabase.storage.from("payment-proofs").createSignedUrls(proofPaths, 60 * 30) : Promise.resolve({ data: [] }),
    supabase.from("support_requests").select("reservation_id").eq("status", "open"),
  ]);
  const proofUrlByPath = new Map((signed ?? []).filter((entry) => entry.path && entry.signedUrl).map((entry) => [entry.path!, entry.signedUrl]));
  const openSupport = new Set((openRequests ?? []).map((request) => request.reservation_id));
  const staleBefore = proofReviewCutoff();
  // The PIN column is hidden from table reads (sellers must not see it); the buyer gets it
  // through a function that only answers for her own reservations.
  const chats = await conversationLinks("buyer");
  const unreadChats = [...chats.values()].reduce((sum, chat) => sum + (chat.order?.unread ?? 0), 0);
  const pins = new Map(await Promise.all(
    reservations.filter((reservation) => reservation.status === "confirmed").map(async (reservation) =>
      [reservation.id, (await supabase.rpc("reservation_delivery_pin", { target: reservation.id })).data as string | null] as const),
  ));

  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-16 pt-6 sm:px-8">
        <Link href="/" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-stone-700 underline-offset-4 hover:underline"><span aria-hidden="true">←</span> Seguir comprando</Link>
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900 sm:text-5xl">Mi cuenta</h1>
        <nav aria-label="Mi cuenta" className="mt-4 flex gap-6 text-sm">
          <Link href="/favoritos" className="flex min-h-11 items-center text-pine underline underline-offset-4">Mis favoritos</Link>
          <Link href="/carrito" className="flex min-h-11 items-center text-pine underline underline-offset-4">Mi carrito</Link>
          <Link href="/cuenta/mensajes" className="flex min-h-11 items-center text-pine underline underline-offset-4">Mensajes{unreadChats > 0 ? ` (${unreadChats})` : ""}</Link>
          <Link href="/recolectoras" className="flex min-h-11 items-center text-pine underline underline-offset-4">Recolectoras</Link>
        </nav>
        <div className="mt-2"><NotificationsToggle /></div>

        {/* Courier answers arrive while she's away (no push yet for this list): one line per
            reservation that changed, linking to it. */}
        {notices.length > 0 && (
          <section aria-label="Novedades de tus recolectoras" className="mt-6 space-y-2">
            {notices.map(({ reservation, notice }) => (
              <a key={reservation.id} href={`#apartado-${reservation.id}`} className={`block border-l-4 p-3 text-sm ${NOTICE_STYLES[notice.tone]}`}>
                <strong>{notice.title}</strong> · {reservation.seller?.store_name ?? "Vendedora"}
              </a>
            ))}
          </section>
        )}

        <section className="mt-8" aria-labelledby="apartados">
          <h2 id="apartados" className="font-condensed text-2xl font-bold uppercase text-stone-900">Mis apartados</h2>
          {reservations.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">Todavía no apartas prendas. Arma tu carrito y dale &ldquo;Apartar&rdquo;.</p>
          ) : (
            <ul className="mt-4 space-y-5">
              {reservations.map((reservation) => {
                const pending = reservation.status === "pending_deposit";
                const courierState = courierStates.get(reservation.id)!;
                const payable = canPayDeposit(reservation);
                const courierName = reservation.courier?.full_name ?? (courierState.kind !== "none" ? courierState.request?.courier?.full_name : null) ?? "";
                return (
                  <li key={reservation.id} id={`apartado-${reservation.id}`} className={`border p-5 ${pending ? "border-pine border-2" : "border-stone-200"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-stone-900">{reservation.seller?.store_name ?? "Vendedora"}</p>
                      <span className={`px-2 py-1 font-condensed text-sm font-bold uppercase ${pending && reservation.proof_rejected_at ? "bg-red-50 text-red-800" : "bg-stone-100 text-stone-800"}`}>
                        {pending && courierState.kind === "waiting" ? "Esperando a la recolectora"
                          : pending && courierState.kind === "needs_choice" ? "Elige otra entrega"
                          : pending && reservation.proof_rejected_at ? "Comprobante rechazado"
                          : pending && reservation.proof_submitted_at ? "Comprobante en revisión"
                          : RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}
                      </span>
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
                        : reservation.delivery_method === "courier" ? `Recolectora ✓ ${courierName} · ${reservation.delivery_address ?? ""} (tarifa ${formatPriceMXN(reservation.delivery_fee_mxn)}, ${reservation.courier_fee_payment === "with_deposit" ? "incluida en tu anticipo" : "se la pagas al recibir"})`
                        : "La acuerdas con la vendedora por WhatsApp"}
                    </p>
                    {!["expired", "cancelled", "no_show"].includes(reservation.status) && <TrackingSteps steps={trackingSteps(reservation)} current={trackingStep(reservation)} />}
                    <p className="mt-2 text-sm text-stone-700">Total {formatPriceMXN(reservation.items_total_mxn)} · anticipo {reservation.deposit_percent} %: <strong className="text-stone-900">{formatPriceMXN(reservation.deposit_mxn)}</strong></p>
                    {reservation.delivery_method === "home_delivery" && <HomeDeliveryFee reservation={reservation} />}

                    {pending && !payable && (
                      <CourierWaitingBlock reservation={reservation} state={courierState} options={reservation.seller ? deliveryOptions.get(reservation.seller.id) ?? null : null} />
                    )}
                    {pending && payable && (
                      <div className="mt-4 space-y-4 text-sm text-stone-800">
                        {courierState.kind === "accepted" && <NoticeBox notice={courierNotice(courierState, reservation)!} />}
                        <DepositPayment
                          reservationId={reservation.id}
                          sellerName={reservation.seller?.store_name ?? "La vendedora"}
                          depositMxn={reservation.deposit_mxn}
                          clabe={reservation.deposit_clabe}
                          oxxoCard={reservation.deposit_oxxo_card}
                          deadlineLabel={dateFormat.format(new Date(reservation.expires_at))}
                          supportOpen={openSupport.has(reservation.id)}
                          proof={{
                            method: reservation.proof_method,
                            reference: reservation.proof_reference,
                            submittedLabel: reservation.proof_submitted_at ? dateFormat.format(new Date(reservation.proof_submitted_at)) : null,
                            rejected: reservation.proof_rejected_at !== null,
                            rejectionReason: reservation.proof_rejection_reason,
                            imageUrl: reservation.proof_path ? proofUrlByPath.get(reservation.proof_path) ?? null : null,
                            stale: reservation.proof_submitted_at !== null && reservation.proof_rejected_at === null && new Date(reservation.proof_submitted_at).getTime() < staleBefore,
                          }}
                        />
                        {/* The seller is told by push (and sees it in her panel); the chat is the main
                            channel. WhatsApp stays as a secondary way to give her a heads-up. */}
                        {reservation.seller_whatsapp && (
                          <div>
                            <a
                              href={whatsappLink(reservation.seller_whatsapp, reservationNoticeMessage({
                                ...reservation,
                                buyerName: buyer?.full_name ?? null,
                                storeName: reservation.seller?.store_name ?? null,
                                depositMxn: reservation.deposit_mxn,
                                items: (reservation.items ?? []).map((item) => ({ name: item.product?.name ?? "Prenda", priceMxn: item.price_mxn })),
                              }))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center text-pine underline underline-offset-4"
                            >
                              Avisarle por WhatsApp
                            </a>
                            <span className="text-stone-600"> (opcional; también le llega el aviso en la app)</span>
                          </div>
                        )}
                        <div><CancelReservationButton reservationId={reservation.id} /></div>
                      </div>
                    )}
                    {reservation.status === "expired" && reservation.proof_submitted_at && (
                      <div className="mt-4"><SupportRequestForm reservationId={reservation.id} reason="released_after_paying" alreadyOpen={openSupport.has(reservation.id)} /></div>
                    )}
                    {reservation.status === "confirmed" && pins.get(reservation.id) && (
                      <div className="mt-4 border-2 border-pine p-4 text-center">
                        <p className="text-sm text-stone-700">Tu código de entrega</p>
                        <p className="mt-1 font-mono text-3xl tracking-[0.4em] text-stone-900" aria-label={`Código de entrega ${pins.get(reservation.id)!.split("").join(" ")}`}>{pins.get(reservation.id)}</p>
                        <p className="mt-1 text-xs text-stone-600">Dáselo a quien te entregue <strong>solo cuando tengas tus prendas</strong>. Con él se marca como entregada.</p>
                      </div>
                    )}
                    {reservation.proof_purged_at && <ProofPurgedNote purgedAt={reservation.proof_purged_at} />}
                    {reservation.status === "completed" && reservation.delivery_method === "courier" && reservation.courier && reservation.courier_rating === null && (
                      <RateCourier reservationId={reservation.id} courierName={reservation.courier.full_name} />
                    )}
                    {reservation.status === "completed" && reservation.courier_rating !== null && <p className="mt-2 text-sm text-stone-600">Calificaste a la recolectora con {reservation.courier_rating} ★</p>}
                    {reservation.status === "confirmed" && (
                      <p className="mt-3 text-sm text-stone-700">
                        La vendedora confirmó tu anticipo. Acuerden la entrega en Mensajes; el resto se paga en la entrega.
                        {reservation.seller_whatsapp && <> También por <a href={`https://wa.me/${reservation.seller_whatsapp.replace("+", "")}`} className="text-pine underline underline-offset-4">WhatsApp</a>.</>}
                        {reservation.delivery_method === "courier" && reservation.courier_whatsapp && <> Tu recolectora: <a href={`https://wa.me/${reservation.courier_whatsapp.replace("+", "")}`} className="text-pine underline underline-offset-4">WhatsApp {reservation.courier_whatsapp}</a>.</>}
                      </p>
                    )}
                    {chats.get(reservation.id)?.order && (
                      <div className="mt-3">
                        <ChatLink href={`/cuenta/mensajes/${chats.get(reservation.id)!.order!.id}`} label="Mensajes con la vendedora" unread={chats.get(reservation.id)!.order!.unread} />
                      </div>
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

        {buyer && (
          <section className="mt-12 border-t border-stone-200 pt-8" aria-labelledby="borrar-cuenta">
            <h2 id="borrar-cuenta" className="font-condensed text-2xl font-bold uppercase text-stone-900">Borrar mi cuenta</h2>
            <p className="mt-1 mb-4 text-sm text-stone-600">Si ya no quieres usar Closets Monterrey, puedes borrar tu cuenta y tus datos.</p>
            <DeleteAccountButton />
          </section>
        )}
      </main>
    </>
  );
}

const NOTICE_STYLES: Record<CourierNotice["tone"], string> = {
  info: "border-stone-500 bg-stone-100 text-stone-900",
  success: "border-pine bg-[#e6eee9] text-stone-900",
  warning: "border-amber-600 bg-amber-50 text-amber-900",
};

// The deadline that matters in each state: her answer while waiting, the payment deadline once
// she accepted, the time to choose again after a no.
function courierNotice(state: CourierDeliveryState, reservation: ReservationRow): CourierNotice | null {
  const deadline = state.kind === "waiting" && state.request ? state.request.expires_at : reservation.expires_at;
  return buyerCourierNotice(state, dateFormat.format(new Date(deadline)));
}

function NoticeBox({ notice }: { notice: CourierNotice }) {
  return (
    <div role="status" data-testid="courier-notice" className={`border-l-4 p-3 text-sm ${NOTICE_STYLES[notice.tone]}`}>
      <p className="font-semibold">{notice.title}</p>
      <p className="mt-1">{notice.body}</p>
    </div>
  );
}

// A courier delivery without a yes: no payment details yet (she must not pay a courier who may
// say no), the notice, and the way to choose again or change course.
function CourierWaitingBlock({ reservation, state, options }: { reservation: ReservationRow; state: CourierDeliveryState; options: Parameters<typeof ChangeDeliveryForm>[0]["options"] | null }) {
  const notice = courierNotice(state, reservation);
  const requests = reservation.requests ?? [];
  const waitingOn = state.kind === "waiting" && reservation.courier_id ? [reservation.courier_id] : [];
  return (
    <div className="mt-4 space-y-4 text-sm text-stone-800">
      {notice && <NoticeBox notice={notice} />}
      {options && (
        <ChangeDeliveryForm
          reservationId={reservation.id}
          options={options}
          itemsTotalMxn={reservation.items_total_mxn}
          depositPercent={reservation.deposit_percent}
          excludedCourierIds={[...declinedCourierIds(requests), ...waitingOn]}
          allowCourier={courierRequestsLeft(requests) > 0}
          municipality={reservation.buyer_municipality ?? ""}
          address={reservation.delivery_address ?? ""}
          startOpen={state.kind === "needs_choice"}
        />
      )}
      <div><CancelReservationButton reservationId={reservation.id} /></div>
    </div>
  );
}

// The shipping fee is an estimate from the zone rates until the buyer sends her deposit; the
// seller may change it before then, and the buyer must not miss it (she can still cancel).
function HomeDeliveryFee({ reservation }: { reservation: ReservationRow }) {
  const change = deliveryFeeChange(reservation);
  const totalWithShipping = formatPriceMXN(reservation.items_total_mxn + reservation.delivery_fee_mxn);
  const stillOpen = reservation.status === "pending_deposit" && reservation.proof_submitted_at === null;
  if (change) {
    return (
      <p className="mt-2 border-l-4 border-amber-600 bg-amber-50 p-3 text-sm text-amber-900" data-testid="delivery-fee-change">
        <strong>La vendedora ajustó el envío de {formatPriceMXN(change.fromMxn)} a {formatPriceMXN(change.toMxn)}.</strong>{" "}
        Nuevo total con envío: <strong>{totalWithShipping}</strong>.
        {stillOpen && " Si no estás de acuerdo, puedes cancelar el apartado antes de pagar el anticipo."}
      </p>
    );
  }
  return (
    <p className="mt-1 text-sm text-stone-700">
      Total con envío: <strong className="text-stone-900">{totalWithShipping}</strong>
      {stillOpen && reservation.delivery_fee_estimate_mxn !== null && " · el envío es aproximado: la vendedora puede ajustarlo antes de que pagues el anticipo."}
    </p>
  );
}

// With a courier the hand-off to her is its own visible step ("Con la recolectora").
function trackingSteps(reservation: ReservationRow): string[] {
  const steps: string[] = DELIVERY_STATUS_STEPS.map((step) => step.label);
  if (reservation.delivery_method === "courier") steps.splice(2, 0, "Con la recolectora");
  return steps;
}

function trackingStep(reservation: ReservationRow): number {
  const courier = reservation.delivery_method === "courier";
  if (reservation.status === "completed") return courier ? 4 : 3;
  if (reservation.status !== "confirmed") return 0;
  if (reservation.delivery_status === "on_the_way") return courier ? 3 : 2;
  if (reservation.delivery_status === "picked_up") return 2;
  return 1;
}

function TrackingSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Seguimiento" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {steps.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined} className="flex items-center gap-2">
          <span className={`px-2 py-1 font-condensed font-bold uppercase ${index < current ? "bg-stone-200 text-stone-700" : index === current ? "bg-pine text-white" : "border border-stone-300 text-stone-500"}`}>{label}</span>
          {index < steps.length - 1 && <span aria-hidden="true" className="text-stone-400">→</span>}
        </li>
      ))}
    </ol>
  );
}
