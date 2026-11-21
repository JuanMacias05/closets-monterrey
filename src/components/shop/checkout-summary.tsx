import { formatPriceMXN } from "@/features/products/format-price";
import type { DraftSummary } from "@/features/shop/checkout-steps";

// What she pays now and at the door for the delivery she is choosing. Recomputed on every
// choice by the caller (checkoutQuote, the reservation function's rules).
export function CheckoutSummary({ label, itemsTotalMxn, depositPercent, summary, quote }: {
  label: string;
  itemsTotalMxn: number;
  depositPercent: number;
  summary: DraftSummary;
  quote: { depositMxn: number; totalMxn: number; dueAtDeliveryMxn: number };
}) {
  const courier = summary.method === "courier";
  return (
    <dl aria-live="polite" aria-label={label} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm text-stone-700 sm:max-w-sm">
      <dt>Prendas</dt><dd className="text-right text-stone-900">{formatPriceMXN(itemsTotalMxn)}</dd>
      {summary.method === "home_delivery" && <><dt>Envío aprox.</dt><dd className="text-right text-stone-900" data-testid="checkout-delivery-fee">{summary.feeMxn !== null ? formatPriceMXN(summary.feeMxn) : "elige tu municipio"}</dd></>}
      {courier && <><dt>Recolectora</dt><dd className="text-right text-stone-900">{summary.feeMxn !== null ? formatPriceMXN(summary.feeMxn) : "elige una"}</dd></>}
      <dt className="font-semibold text-stone-900">Total</dt><dd className="text-right font-semibold text-stone-900" data-testid="checkout-total">{formatPriceMXN(quote.totalMxn)}</dd>
      {/* With a courier she pays only once the courier accepts. */}
      <dt>Anticipo ({depositPercent} %), {courier ? "cuando acepte" : "ahora"}</dt><dd className="text-right font-semibold text-stone-900" data-testid="checkout-deposit">{formatPriceMXN(quote.depositMxn)}</dd>
      <dt>Al recibir</dt><dd className="text-right text-stone-900">{formatPriceMXN(quote.dueAtDeliveryMxn)}</dd>
    </dl>
  );
}
