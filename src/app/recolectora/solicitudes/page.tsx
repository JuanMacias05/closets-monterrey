import { CourierRequestActions } from "@/app/recolectora/solicitudes/request-actions";
import { COURIER_REQUEST_HOURS } from "@/features/couriers/constants";
import { timeLeftLabel, type CourierRequestStatus } from "@/features/couriers/courier-requests";
import { requireCourier } from "@/features/couriers/require-courier";
import { formatPriceMXN } from "@/features/products/format-price";

export const metadata = { title: "Solicitudes | Closets Monterrey" };

type InboxRow = {
  request_id: string; status: CourierRequestStatus; requested_at: string; expires_at: string; resolved_at: string | null;
  rejection_reason: string | null; fee_mxn: number; fee_payment: "on_delivery" | "with_deposit";
  store_name: string; pickup_points: string[]; buyer_municipality: string | null; garments: string[] | null;
};

const OUTCOME: Record<CourierRequestStatus, string> = {
  requested: "Por responder",
  accepted: "Aceptaste",
  rejected: "Rechazaste",
  expired: "Se venció sin respuesta",
  withdrawn: "La clienta cambió de entrega",
};

const timeFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Monterrey" });

// Deliveries buyers asked her for. She sees what she needs to decide (store, where she'd
// collect, the buyer's municipality, the garments, her fee), never who the buyer is: that comes
// with the job, in "Mis entregas", once she accepts.
export default async function CourierRequestsPage() {
  const { courier, supabase } = await requireCourier("/recolectora/solicitudes");
  await supabase.rpc("release_expired_reservations");
  const { data } = await supabase.rpc("courier_request_inbox");
  const rows = (data ?? []) as InboxRow[];
  const waiting = rows.filter((row) => row.status === "requested");
  const answered = rows.filter((row) => row.status !== "requested");
  const now = new Date();

  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Solicitudes</h1>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">
        Cada solicitud espera tu respuesta {COURIER_REQUEST_HOURS} horas; si no contestas, se vence y la clienta elige otra entrega. Al aceptar ves su nombre y dirección en Mis entregas. Ella no paga nada hasta que aceptas.
      </p>
      {courier.status !== "approved" && (
        <p className="mt-4 text-sm text-stone-700">Cuando la administración te verifique, aquí te llegan las entregas que te pidan.</p>
      )}

      {waiting.length === 0 ? (
        <p className="mt-6 border-y border-stone-200 py-8 text-center text-sm text-stone-600">No tienes solicitudes por responder.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {waiting.map((row) => {
            const left = timeLeftLabel(row.expires_at, now);
            return (
              <li key={row.request_id} className="border-2 border-pine bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-stone-900">{row.store_name} → {row.buyer_municipality}</p>
                  <span className="bg-amber-100 px-2 py-1 font-condensed text-sm font-bold uppercase text-amber-900">
                    {left ? `Quedan ${left}` : "Por vencer"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-stone-700"><strong>Recoges en:</strong> {row.pickup_points.join(", ") || "—"}</p>
                <p className="text-sm text-stone-700"><strong>Entregas en:</strong> {row.buyer_municipality}</p>
                <p className="text-sm text-stone-700"><strong>Prendas:</strong> {(row.garments ?? []).join(", ")}</p>
                <p className="text-sm text-stone-700">
                  <strong>Tu tarifa:</strong> {formatPriceMXN(row.fee_mxn)} · {row.fee_payment === "with_deposit" ? "te la paga la vendedora (va en el anticipo)" : "te la paga la clienta al recibir"}
                </p>
                <p className="mt-1 text-xs text-stone-600">Responde antes de {timeFormat.format(new Date(row.expires_at))}.</p>
                <div className="mt-4"><CourierRequestActions requestId={row.request_id} storeName={row.store_name} /></div>
              </li>
            );
          })}
        </ul>
      )}

      {answered.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer py-3 text-sm font-medium text-stone-700">Respondidas y vencidas, últimos 14 días ({answered.length})</summary>
          <ul className="mt-2 divide-y divide-stone-200 border-y border-stone-200">
            {answered.map((row) => (
              <li key={row.request_id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm text-stone-700">
                <span>{row.store_name} · {timeFormat.format(new Date(row.requested_at))}</span>
                <span className="text-stone-900">
                  {OUTCOME[row.status]}{row.status === "rejected" && row.rejection_reason ? `: “${row.rejection_reason}”` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
