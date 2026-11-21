import { COURIER_REQUEST_HOURS } from "@/features/couriers/constants";

// Reserving is three steps: 1 Tus prendas · 2 Entrega · 3 Anticipo. The delivery step is also
// what a buyer fills in again on /cuenta when her courier says no, so its rules live here, away
// from both screens.

export const CHECKOUT_STEPS = ["Tus prendas", "Entrega", "Anticipo"] as const;

export type CourierOption = {
  id: string; fullName: string; municipalities: string[]; feeMxn: number;
  pointNames: string[]; days: number[]; timeWindow: string | null; rating: number | null; deliveries: number;
};

export type SellerDeliveryOptions = {
  points: { id: string; name: string }[];
  // Priced from the zone rates: the seller's origin to the buyer's municipality.
  homeDelivery: { origin: string; note: string | null; feesByMunicipality: Record<string, number> } | null;
  // Couriers who collect at one of this seller's points; filtered by municipality on screen.
  couriers: CourierOption[];
};

// What the reservation functions take (reserve_cart_from_seller, change_reservation_delivery).
export type DeliveryChoice =
  | { method: "pickup_point"; pointId: string }
  | { method: "home_delivery"; municipality: string; address: string }
  | { method: "courier"; courierId: string; municipality: string; address: string; feePayment: "on_delivery" | "with_deposit" }
  | { method: "arranged" };

// What the buyer has picked so far in the delivery step. `choice` is the answer when she
// doesn't want a courier: "point:<id>", "home" or "arranged".
export type DeliveryDraft = {
  wantsCourier: boolean;
  choice: string;
  municipality: string;
  courierId: string;
  feePayment: "on_delivery" | "with_deposit";
  address: string;
};

export function initialDeliveryDraft(options: SellerDeliveryOptions): DeliveryDraft {
  return {
    wantsCourier: false,
    choice: options.points[0] ? `point:${options.points[0].id}` : options.homeDelivery ? "home" : "arranged",
    municipality: "",
    courierId: "",
    feePayment: "on_delivery",
    address: "",
  };
}

// The seller offers neither a point nor home delivery: the only way is to arrange it with her.
export function offersOnlyArranged(options: SellerDeliveryOptions): boolean {
  return options.points.length === 0 && options.homeDelivery === null;
}

// Couriers the buyer can ask for her municipality, minus any who already said no to this
// reservation (the database refuses to ask them again).
export function couriersFor(options: SellerDeliveryOptions, municipality: string, excludedIds: readonly string[] = []): CourierOption[] {
  if (!municipality) return [];
  return options.couriers.filter((courier) => courier.municipalities.includes(municipality) && !excludedIds.includes(courier.id));
}

export function homeFeeFor(options: SellerDeliveryOptions, municipality: string): number | null {
  if (!options.homeDelivery || !municipality) return null;
  return options.homeDelivery.feesByMunicipality[municipality] ?? null;
}

export type DraftSummary = {
  method: "pickup_point" | "home_delivery" | "courier" | "arranged";
  // null while what prices it (her municipality, a courier) is still missing.
  feeMxn: number | null;
  courier: CourierOption | null;
  pointName: string | null;
};

export function summarizeDraft(options: SellerDeliveryOptions, draft: DeliveryDraft, excludedIds: readonly string[] = []): DraftSummary {
  if (draft.wantsCourier) {
    const courier = couriersFor(options, draft.municipality, excludedIds).find((option) => option.id === draft.courierId) ?? null;
    return { method: "courier", feeMxn: courier?.feeMxn ?? null, courier, pointName: null };
  }
  if (draft.choice === "home") return { method: "home_delivery", feeMxn: homeFeeFor(options, draft.municipality), courier: null, pointName: null };
  if (draft.choice.startsWith("point:")) {
    const id = draft.choice.slice("point:".length);
    return { method: "pickup_point", feeMxn: 0, courier: null, pointName: options.points.find((point) => point.id === id)?.name ?? null };
  }
  return { method: "arranged", feeMxn: 0, courier: null, pointName: null };
}

// Why the buyer can't leave the delivery step yet, or null when she can. Same checks the
// reservation functions make, said in her words.
export function deliveryDraftError(options: SellerDeliveryOptions, draft: DeliveryDraft, excludedIds: readonly string[] = []): string | null {
  const needsAddress = draft.wantsCourier || draft.choice === "home";
  if (draft.wantsCourier) {
    if (!draft.municipality) return "Elige tu municipio para ver qué recolectoras llegan.";
    if (couriersFor(options, draft.municipality, excludedIds).length === 0) {
      return `Ninguna recolectora disponible cubre ${draft.municipality} para esta vendedora. Elige “No, gracias” para ver las otras formas de entrega.`;
    }
    if (!summarizeDraft(options, draft, excludedIds).courier) return "Elige una recolectora.";
  } else if (draft.choice === "home") {
    if (!draft.municipality) return "Elige tu municipio para calcular el envío.";
    if (homeFeeFor(options, draft.municipality) === null) return `Todavía no hay tarifa de envío a ${draft.municipality}. Elige otra forma de entrega.`;
  } else if (draft.choice === "arranged" && !offersOnlyArranged(options)) {
    return "Elige cómo quieres recibir tus prendas.";
  }
  if (needsAddress && draft.address.trim().length < 10) return "Escribe tu dirección completa (calle, número, colonia y municipio).";
  return null;
}

export function draftToChoice(options: SellerDeliveryOptions, draft: DeliveryDraft): DeliveryChoice {
  if (draft.wantsCourier) {
    return { method: "courier", courierId: draft.courierId, municipality: draft.municipality, address: draft.address.trim(), feePayment: draft.feePayment };
  }
  if (draft.choice === "home") return { method: "home_delivery", municipality: draft.municipality, address: draft.address.trim() };
  if (draft.choice.startsWith("point:")) return { method: "pickup_point", pointId: draft.choice.slice("point:".length) };
  return offersOnlyArranged(options) ? { method: "arranged" } : { method: "pickup_point", pointId: "" };
}

// Step 3's explanation of when she pays.
export function depositTimingNote(summary: DraftSummary): string {
  if (summary.method === "courier") {
    const name = summary.courier?.fullName ?? "La recolectora";
    return `Al apartar le enviamos tu solicitud a ${name}. Tiene ${COURIER_REQUEST_HOURS} horas para aceptar; mientras tanto tus prendas quedan apartadas y no pagas nada. Cuando acepte, tienes 24 horas para transferir el anticipo.`;
  }
  return "Al apartar tienes 24 horas para transferir el anticipo a la vendedora; si no, las prendas se liberan.";
}

// One line for step 3's "Entrega:".
export function describeDraft(summary: DraftSummary, draft: Pick<DeliveryDraft, "municipality" | "feePayment">): string {
  if (summary.method === "pickup_point") return `Punto fijo · ${summary.pointName ?? ""}`;
  if (summary.method === "home_delivery") return `Envío a domicilio a ${draft.municipality}`;
  if (summary.method === "courier") {
    return `Recolectora ✓ ${summary.courier?.fullName ?? ""} a ${draft.municipality} · su tarifa ${draft.feePayment === "with_deposit" ? "va incluida en tu anticipo" : "se la pagas al recibir"}`;
  }
  return "La acuerdas con la vendedora por WhatsApp";
}
