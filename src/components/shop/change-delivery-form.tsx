"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutSummary } from "@/components/shop/checkout-summary";
import { DeliveryStep } from "@/components/shop/delivery-step";
import { changeReservationDelivery } from "@/features/shop/actions";
import { couriersFor, deliveryDraftError, draftToChoice, initialDeliveryDraft, summarizeDraft, type SellerDeliveryOptions } from "@/features/shop/checkout-steps";
import { checkoutQuote } from "@/features/shop/reservation-money";

// On /cuenta: choose again after a courier said no or didn't answer, or change course while still
// waiting for her. Same delivery step as the cart; the database re-checks everything
// (change_reservation_delivery) and keeps the garments held meanwhile.
export function ChangeDeliveryForm({ reservationId, options, itemsTotalMxn, depositPercent, excludedCourierIds, allowCourier, municipality, address, startOpen }: {
  reservationId: string;
  options: SellerDeliveryOptions;
  itemsTotalMxn: number;
  depositPercent: number;
  excludedCourierIds: string[];
  allowCourier: boolean;
  // What she typed when reserving, so she doesn't type it again.
  municipality: string;
  address: string;
  startOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [draft, setDraft] = useState(() => ({
    ...initialDeliveryDraft(options),
    wantsCourier: allowCourier && couriersFor(options, municipality, excludedCourierIds).length > 0,
    municipality,
    address,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = summarizeDraft(options, draft, excludedCourierIds);
  const quote = checkoutQuote({ itemsTotalMxn, depositPercent, deliveryMethod: summary.method, deliveryFeeMxn: summary.feeMxn, courierFeePayment: draft.feePayment });

  async function save() {
    const effective = allowCourier ? draft : { ...draft, wantsCourier: false };
    const problem = deliveryDraftError(options, effective, excludedCourierIds);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await changeReservationDelivery(reservationId, draftToChoice(options, effective));
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-sm text-pine underline underline-offset-4">
        Cambiar de entrega
      </button>
    );
  }

  return (
    <section aria-label="Elegir otra entrega" className="space-y-4 border border-stone-300 bg-white p-4">
      <DeliveryStep
        idPrefix={`change-${reservationId}`}
        options={options}
        draft={draft}
        onChange={(next) => { setDraft(next); setError(null); }}
        excludedCourierIds={excludedCourierIds}
        allowCourier={allowCourier}
      />
      <CheckoutSummary label="Resumen con la nueva entrega" itemsTotalMxn={itemsTotalMxn} depositPercent={depositPercent} summary={summary} quote={quote} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="press min-h-12 bg-pine px-6 font-condensed text-base font-bold uppercase text-white disabled:opacity-60">
          {busy ? "Guardando…" : summary.method === "courier" ? "Pedir a esta persona" : "Guardar entrega"}
        </button>
        {!startOpen && <button type="button" onClick={() => setOpen(false)} disabled={busy} className="min-h-11 text-sm text-stone-700 underline underline-offset-4">Cancelar</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
