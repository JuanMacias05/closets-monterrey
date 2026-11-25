import { COURIER_REQUEST_HOURS, MAX_COURIER_REQUESTS } from "@/features/couriers/constants";

// A courier delivery goes through a request the courier accepts or rejects
// (20261124000100). The database holds the state machine; these helpers only read it back for
// the screens, so the buyer, the seller and the courier all describe it the same way.

export type CourierRequestStatus = "requested" | "accepted" | "rejected" | "expired" | "withdrawn";

export type CourierRequestRow = {
  id: string;
  status: CourierRequestStatus;
  requested_at: string;
  expires_at: string;
  resolved_at: string | null;
  rejection_reason: string | null;
  courier_id: string;
  courier: { full_name: string } | null;
};

export type CourierReservationFields = {
  delivery_method: string;
  courier_id: string | null;
  courier_accepted_at: string | null;
};

export type CourierDeliveryState =
  // Not a courier delivery.
  | { kind: "none" }
  // Waiting for the courier's answer; the buyer can't pay yet.
  | { kind: "waiting"; request: CourierRequestRow | null }
  // The courier took the job; the buyer can pay.
  | { kind: "accepted"; request: CourierRequestRow | null }
  // The last courier said no or didn't answer; the buyer has to choose again.
  | { kind: "needs_choice"; request: CourierRequestRow | null };

export function latestCourierRequest(requests: readonly CourierRequestRow[] | null | undefined): CourierRequestRow | null {
  let latest: CourierRequestRow | null = null;
  for (const request of requests ?? []) {
    if (!latest || request.requested_at > latest.requested_at) latest = request;
  }
  return latest;
}

// Read from the reservation's own columns (what the database functions check), with the
// latest request only for who and when.
export function courierDeliveryState(reservation: CourierReservationFields, requests: readonly CourierRequestRow[] | null | undefined): CourierDeliveryState {
  if (reservation.delivery_method !== "courier") return { kind: "none" };
  const latest = latestCourierRequest(requests);
  if (reservation.courier_accepted_at) return { kind: "accepted", request: latest };
  if (reservation.courier_id) return { kind: "waiting", request: latest?.status === "requested" ? latest : null };
  return { kind: "needs_choice", request: latest };
}

// Same rule as submit_deposit_proof and update_reservation('confirm').
export function canPayDeposit(reservation: CourierReservationFields): boolean {
  return reservation.delivery_method !== "courier" || reservation.courier_accepted_at !== null;
}

// Couriers who said no to this reservation: the database refuses to ask them again, so the
// buyer's chooser leaves them out. One who only let the time run out can be asked again.
export function declinedCourierIds(requests: readonly CourierRequestRow[] | null | undefined): string[] {
  return [...new Set((requests ?? []).filter((request) => request.status === "rejected").map((request) => request.courier_id))];
}

export function courierRequestsLeft(requests: readonly CourierRequestRow[] | null | undefined): number {
  return Math.max(0, MAX_COURIER_REQUESTS - (requests ?? []).length);
}

// "1 h 20 min" / "45 min" / "menos de 1 min" until a deadline; null once it has passed.
export function timeLeftLabel(untilIso: string, now: Date = new Date()): string | null {
  const minutes = Math.floor((new Date(untilIso).getTime() - now.getTime()) / 60_000);
  if (Number.isNaN(minutes) || new Date(untilIso).getTime() <= now.getTime()) return null;
  if (minutes < 1) return "menos de 1 min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export type CourierNotice = { tone: "info" | "success" | "warning"; title: string; body: string };

// The buyer's notice on /cuenta for an open reservation with a courier. `deadlineLabel` is the
// formatted deadline that matters in each state: the courier's answer while waiting, the
// payment deadline once accepted, the time to choose again after a no.
export function buyerCourierNotice(state: CourierDeliveryState, deadlineLabel: string): CourierNotice | null {
  const name = state.kind === "none" ? "" : state.request?.courier?.full_name ?? "Quien recolecta";
  switch (state.kind) {
    case "none":
      return null;
    case "waiting":
      return {
        tone: "info",
        title: `Esperando a que ${name} acepte`,
        body: `Le enviamos tu solicitud; tiene ${COURIER_REQUEST_HOURS} horas para responder (a más tardar ${deadlineLabel}). Todavía no pagues nada: tu anticipo se habilita cuando acepte, y desde ese momento tienes 24 horas.`,
      };
    case "accepted":
      return {
        tone: "success",
        title: `${name} aceptó llevar tus prendas`,
        body: `Ya puedes pagar tu anticipo. Tienes hasta ${deadlineLabel}.`,
      };
    case "needs_choice": {
      const why = state.request?.status === "expired"
        ? `${name} no respondió a tiempo.`
        : state.request?.rejection_reason
          ? `${name} no puede llevar tu pedido: “${state.request.rejection_reason}”.`
          : `${name} no puede llevar tu pedido.`;
      return {
        tone: "warning",
        title: state.request?.status === "expired" ? "Quien recolecta no respondió" : "Quien recolecta no aceptó",
        body: `${why} Pide a alguien más o cambia a punto fijo o envío a domicilio antes del ${deadlineLabel}; si no, tus prendas se liberan. No has pagado nada.`,
      };
    }
  }
}
