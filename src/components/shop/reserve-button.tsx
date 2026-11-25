"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckoutSummary } from "@/components/shop/checkout-summary";
import { DeliveryStep } from "@/components/shop/delivery-step";
import { formatPriceMXN } from "@/features/products/format-price";
import { reserveFromSeller } from "@/features/shop/actions";
import {
  CHECKOUT_STEPS,
  deliveryDraftError,
  depositTimingNote,
  describeDraft,
  draftToChoice,
  initialDeliveryDraft,
  summarizeDraft,
  type SellerDeliveryOptions,
} from "@/features/shop/checkout-steps";
import { checkoutQuote, depositForGarments } from "@/features/shop/reservation-money";

// Reserving one seller's group in the cart, in three steps: 1 Tus prendas · 2 Entrega ·
// 3 Anticipo. Step 3 is the confirmation (what she pays now, at the door, and when), so there is
// no extra "¿Continuar?" dialog. Money rules are the reservation function's (checkoutQuote).
export function ReserveButton({ sellerId, storeName, itemsTotalMxn, itemCount, depositPercent, disabled, options }: {
  sellerId: string; storeName: string; itemsTotalMxn: number; itemCount: number; depositPercent: number; disabled: boolean; options: SellerDeliveryOptions;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDeliveryDraft(options));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Focus follows the step only after she moves; never on first render (it would scroll the
  // cart down to the last seller's group).
  const moved = useRef(false);

  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [step]);

  const summary = summarizeDraft(options, draft);
  const quote = checkoutQuote({
    itemsTotalMxn,
    depositPercent,
    deliveryMethod: summary.method,
    deliveryFeeMxn: summary.feeMxn,
    courierFeePayment: draft.feePayment,
  });

  function go(next: number) {
    moved.current = true;
    setError(null);
    setStep(next);
  }

  function toDeposit() {
    const problem = deliveryDraftError(options, draft);
    if (problem) {
      setError(problem);
      return;
    }
    go(2);
  }

  async function reserve() {
    setBusy(true);
    setError(null);
    const result = await reserveFromSeller(sellerId, draftToChoice(options, draft));
    if (result.ok) {
      router.push(`/cuenta#apartado-${result.reservationId}`);
      router.refresh();
    } else {
      setError(result.error);
      router.refresh();
    }
    setBusy(false);
  }

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const };
  const primary = "press min-h-12 w-full bg-pine px-6 font-condensed text-base font-bold uppercase text-white disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 sm:w-auto";
  const back = "min-h-12 px-2 text-sm text-stone-700 underline underline-offset-4 disabled:opacity-50";

  return (
    <div className="flex w-full flex-col gap-4">
      <ol aria-label={`Pasos para apartar de ${storeName}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {CHECKOUT_STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? "step" : undefined} className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 px-2 py-1 font-condensed font-bold uppercase ${index < step ? "bg-stone-200 text-stone-700" : index === step ? "bg-pine text-white" : "border border-stone-300 text-stone-500"}`}>
              <span aria-hidden="true">{index + 1}</span> {label}
            </span>
            {index < CHECKOUT_STEPS.length - 1 && <span aria-hidden="true" className="text-stone-400">·</span>}
          </li>
        ))}
      </ol>

      {/* One heading for every step, outside the animated body, so focus can land on it the
          moment the step changes instead of waiting for the exit animation. */}
      <h3 ref={headingRef} tabIndex={-1} className="font-condensed text-lg font-bold uppercase text-stone-900 outline-none">
        <span className="sr-only">Paso {step + 1} de {CHECKOUT_STEPS.length}: </span>{CHECKOUT_STEPS[step]}
      </h3>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : -12 }}
          transition={transition}
          className="flex flex-col gap-4"
        >
          {step === 0 && (
            <>
              <p className="text-sm text-stone-800">
                {itemCount} {itemCount === 1 ? "prenda" : "prendas"} de {storeName} · <strong>{formatPriceMXN(itemsTotalMxn)}</strong>
              </p>
              <p className="text-sm text-stone-600">
                Al apartar, nadie más puede comprarlas mientras pagas un anticipo del {depositPercent} % ({formatPriceMXN(depositForGarments(itemsTotalMxn, depositPercent))}). El resto se paga al recibir.
              </p>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button type="button" onClick={() => go(1)} disabled={disabled} className={primary}>Elegir entrega</button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <DeliveryStep idPrefix={`checkout-${sellerId}`} options={options} draft={draft} onChange={(next) => { setDraft(next); setError(null); }} />
              <CheckoutSummary label={`Resumen de ${storeName}`} itemsTotalMxn={itemsTotalMxn} depositPercent={depositPercent} summary={summary} quote={quote} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => go(0)} className={back}>Volver</button>
                <button type="button" onClick={toDeposit} className={primary}>Continuar al anticipo</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-stone-800"><strong>Entrega:</strong> {describeDraft(summary, draft)}</p>
              <CheckoutSummary label={`Resumen de ${storeName}`} itemsTotalMxn={itemsTotalMxn} depositPercent={depositPercent} summary={summary} quote={quote} />
              <p className="border-l-4 border-pine bg-[#e6eee9] p-3 text-sm text-stone-800">{depositTimingNote(summary)}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => go(1)} disabled={busy} className={back}>Volver</button>
                <button type="button" onClick={reserve} disabled={disabled || busy} className={primary}>
                  {busy ? "Apartando…" : summary.method === "courier" ? "Apartar y pedir recolección" : `Apartar · anticipo ${formatPriceMXN(quote.depositMxn)}`}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
