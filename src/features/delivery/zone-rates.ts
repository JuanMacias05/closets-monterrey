import { MUNICIPALITIES } from "@/features/couriers/constants";

// Home delivery is priced from delivery_zone_rates (20261123000100): what it costs to send from
// the seller's municipality to the buyer's. Admins set the prices; nobody types a fee at checkout.

export type Municipality = (typeof MUNICIPALITIES)[number];

export type ZoneRateRow = { origin_municipality: string; destination_municipality: string; fee_mxn: number };

// Same ceiling as the database checks (rates and seller adjustments): $1,000, in cents.
export const MAX_DELIVERY_FEE_MXN = 100000;

export function isKnownMunicipality(value: unknown): value is Municipality {
  return typeof value === "string" && (MUNICIPALITIES as readonly string[]).includes(value);
}

// Fees from one origin, keyed by the buyer's municipality. A destination without a row is left
// out, so the cart can say "no rate yet" instead of inventing one.
export function feesFromOrigin(rates: readonly ZoneRateRow[], origin: string): Record<string, number> {
  const fees: Record<string, number> = {};
  for (const rate of rates) {
    if (rate.origin_municipality === origin) fees[rate.destination_municipality] = rate.fee_mxn;
  }
  return fees;
}

export function feeRange(fees: Record<string, number>): { min: number; max: number } | null {
  const values = Object.values(fees);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

// What an admin (a rate) or a seller (an adjustment) typed, in pesos. Whole pesos only: a
// shipping price with cents is a typo, and the database refuses it anyway.
export function parseDeliveryFeePesos(input: string): { ok: true; cents: number } | { ok: false; error: string } {
  const text = typeof input === "string" ? input.trim().replace(/^\$/, "").replace(/,/g, "") : "";
  if (!/^\d+(\.0{1,2})?$/.test(text)) return { ok: false, error: "Escribe el costo en pesos enteros, por ejemplo 90." };
  const cents = Math.round(Number(text) * 100);
  if (cents > MAX_DELIVERY_FEE_MXN) return { ok: false, error: "El envío no puede pasar de $1,000." };
  return { ok: true, cents };
}
