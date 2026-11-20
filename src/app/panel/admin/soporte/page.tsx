import { redirect } from "next/navigation";
import { ResolveRequestForm } from "@/app/panel/admin/soporte/resolve-request-form";
import { formatPriceMXN } from "@/features/products/format-price";
import { RESERVATION_STATUS_LABELS } from "@/features/shop/reservation-labels";
import { whatsappLink } from "@/features/shop/whatsapp-message";
import { PROOF_REVIEW_HOURS, proofReviewCutoff, SUPPORT_REASON_LABELS } from "@/features/support/support-contact";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Soporte | Closets Monterrey" };

type ReservationInfo = {
  id: string; status: string; deposit_mxn: number; seller_whatsapp: string | null; created_at: string; expires_at: string;
  proof_path: string | null; proof_method: string | null; proof_reference: string | null;
  proof_submitted_at: string | null; proof_rejected_at: string | null; proof_rejection_reason: string | null;
  buyer_id: string | null;
  seller: { store_name: string } | null;
  items: { price_mxn: number; product: { name: string } | null }[] | null;
};

type RequestRow = {
  id: string; reason: string; message: string; status: string; resolution_note: string | null;
  created_at: string; resolved_at: string | null; buyer_id: string | null; reservation: ReservationInfo | null;
};

const RESERVATION_FIELDS = "id,status,deposit_mxn,seller_whatsapp,created_at,expires_at,proof_path,proof_method,proof_reference,proof_submitted_at,proof_rejected_at,proof_rejection_reason,buyer_id,seller:profiles!reservations_seller_id_fkey(store_name),items:reservation_items(price_mxn,product:products(name))";
const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Monterrey" });

// Support inbox. There is no support team or channel yet, so this is where a buyer's request
// for help lands, together with proofs that a seller has left unreviewed for 48 hours.
export default async function AdminSupportPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
  if (admin?.role !== "admin" || admin.status !== "approved") redirect("/panel");

  const staleBefore = new Date(proofReviewCutoff()).toISOString();
  const [{ data: requestRows, error }, { data: staleRows }] = await Promise.all([
    supabase.from("support_requests")
      .select(`id,reason,message,status,resolution_note,created_at,resolved_at,buyer_id,reservation:reservations(${RESERVATION_FIELDS})`)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("reservations").select(RESERVATION_FIELDS)
      .eq("status", "pending_deposit").not("proof_submitted_at", "is", null).is("proof_rejected_at", null)
      .lt("proof_submitted_at", staleBefore)
      .order("proof_submitted_at", { ascending: true }),
  ]);
  if (error) throw new Error("No pudimos cargar las solicitudes de soporte.");
  const requests = (requestRows ?? []) as unknown as RequestRow[];
  const stale = (staleRows ?? []) as unknown as ReservationInfo[];
  const open = requests.filter((request) => request.status === "open");
  const resolved = requests.filter((request) => request.status === "resolved");

  const reservations = [...requests.map((request) => request.reservation), ...stale].filter((r): r is ReservationInfo => r !== null);
  const buyerIds = [...new Set(reservations.map((r) => r.buyer_id).filter((id): id is string => id !== null))];
  const proofPaths = [...new Set(reservations.map((r) => r.proof_path).filter((path): path is string => Boolean(path)))];
  const [{ data: buyers }, { data: signed }] = await Promise.all([
    buyerIds.length ? supabase.from("buyer_profiles").select("id,full_name,phone_e164").in("id", buyerIds) : Promise.resolve({ data: [] }),
    proofPaths.length ? supabase.storage.from("payment-proofs").createSignedUrls(proofPaths, 60 * 30) : Promise.resolve({ data: [] }),
  ]);
  const buyerById = new Map((buyers ?? []).map((buyer) => [buyer.id, buyer]));
  const proofUrlByPath = new Map((signed ?? []).filter((entry) => entry.path && entry.signedUrl).map((entry) => [entry.path!, entry.signedUrl]));

  function ReservationSummary({ reservation }: { reservation: ReservationInfo }) {
    const buyer = reservation.buyer_id ? buyerById.get(reservation.buyer_id) : undefined;
    const imageUrl = reservation.proof_path ? proofUrlByPath.get(reservation.proof_path) : undefined;
    return (
      <div className="space-y-3 text-sm text-stone-700">
        <p>
          <strong className="text-stone-900">{buyer?.full_name ?? "Cuenta borrada"}</strong> apartó con <strong className="text-stone-900">{reservation.seller?.store_name ?? "una vendedora"}</strong>
          {" · "}{(reservation.items ?? []).map((item) => item.product?.name ?? "Prenda").join(", ")}
          {" · "}anticipo {formatPriceMXN(reservation.deposit_mxn)}{reservation.proof_method === "oxxo" ? " en OXXO" : reservation.proof_method === "transfer" ? " por transferencia" : ""}
          {" · "}<span className="font-condensed font-bold uppercase">{RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}</span>
        </p>
        <div className="flex flex-wrap items-start gap-4">
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Ver comprobante completo">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private file */}
              <img src={imageUrl} alt="Comprobante" className="h-32 w-24 border border-stone-200 object-cover" />
            </a>
          )}
          <ol className="min-w-0 space-y-1 text-xs text-stone-600">
            <li>Apartó: {dateFormat.format(new Date(reservation.created_at))}</li>
            {reservation.proof_submitted_at && <li>Subió comprobante: {dateFormat.format(new Date(reservation.proof_submitted_at))}{reservation.proof_reference ? ` · ${reservation.proof_method === "oxxo" ? "folio" : "rastreo"} ${reservation.proof_reference}` : ""}</li>}
            {reservation.proof_rejected_at && <li className="text-red-800">Rechazado: {dateFormat.format(new Date(reservation.proof_rejected_at))} · “{reservation.proof_rejection_reason}”</li>}
            {reservation.status === "pending_deposit" && <li>Vence: {dateFormat.format(new Date(reservation.expires_at))}{reservation.proof_submitted_at && !reservation.proof_rejected_at ? " (detenido: comprobante en revisión)" : ""}</li>}
          </ol>
        </div>
        <p className="flex flex-wrap gap-x-4">
          {buyer?.phone_e164 && <a href={whatsappLink(buyer.phone_e164)} target="_blank" rel="noopener noreferrer" className="text-pine underline underline-offset-4">WhatsApp a {buyer.full_name}</a>}
          {reservation.seller_whatsapp && <a href={whatsappLink(reservation.seller_whatsapp)} target="_blank" rel="noopener noreferrer" className="text-pine underline underline-offset-4">WhatsApp a {reservation.seller?.store_name ?? "la vendedora"}</a>}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-10">
      <div className="border-b border-stone-200 pb-5">
        <h1 className="font-serif text-3xl tracking-tight text-stone-900">Soporte</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">Aquí llegan las clientas que piden ayuda con un apartado y los comprobantes que una vendedora lleva más de {PROOF_REVIEW_HOURS} horas sin revisar. Mientras no haya canal de soporte, contesta por WhatsApp.</p>
      </div>

      <section aria-labelledby="open-requests">
        <h2 id="open-requests" className="font-condensed text-xl font-bold uppercase text-stone-900">Solicitudes abiertas ({open.length})</h2>
        {open.length === 0 ? <p className="mt-3 text-sm text-stone-600">No hay solicitudes abiertas.</p> : (
          <ul className="mt-4 space-y-4">
            {open.map((request) => (
              <li key={request.id} className="space-y-4 border-2 border-pine bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-stone-900">{SUPPORT_REASON_LABELS[request.reason] ?? request.reason}</p>
                  <span className="text-xs text-stone-500">{dateFormat.format(new Date(request.created_at))}</span>
                </div>
                <blockquote className="border-l-2 border-stone-300 pl-3 text-sm text-stone-800">{request.message}</blockquote>
                {request.reservation && <ReservationSummary reservation={request.reservation} />}
                <ResolveRequestForm requestId={request.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="stale-proofs">
        <h2 id="stale-proofs" className="font-condensed text-xl font-bold uppercase text-stone-900">Comprobantes sin revisar más de {PROOF_REVIEW_HOURS} h ({stale.length})</h2>
        {stale.length === 0 ? <p className="mt-3 text-sm text-stone-600">Ninguno: las vendedoras están al día.</p> : (
          <ul className="mt-4 space-y-4">
            {stale.map((reservation) => (
              <li key={reservation.id} className="border border-amber-300 bg-white p-5"><ReservationSummary reservation={reservation} /></li>
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 && (
        <details>
          <summary className="cursor-pointer py-2 text-sm font-medium text-stone-700">Resueltas ({resolved.length})</summary>
          <ul className="mt-3 divide-y divide-stone-200">
            {resolved.map((request) => (
              <li key={request.id} className="py-3 text-sm text-stone-700">
                <p><strong className="text-stone-900">{SUPPORT_REASON_LABELS[request.reason] ?? request.reason}</strong> · {request.reservation?.seller?.store_name ?? ""} · resuelta el {request.resolved_at ? dateFormat.format(new Date(request.resolved_at)) : ""}</p>
                {request.resolution_note && <p className="mt-1 text-stone-600">{request.resolution_note}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
