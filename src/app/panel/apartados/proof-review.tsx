"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rejectDepositProof } from "@/app/panel/apartados/actions";

const REASONS = ["No me llegó el dinero", "El monto no coincide", "La foto no se lee"];

// Rejecting tells the buyer why, in her account, and gives her at least 12 more hours to
// upload another proof. Confirming stays in ReservationActions ("Confirmar anticipo").
export function ProofReview({ reservationId, buyerName }: { reservationId: string; buyerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await rejectDepositProof(reservationId, reason);
    if (result.ok) { setOpen(false); router.refresh(); }
    else setError(result.error);
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 border-2 border-[#a3261b] px-3 font-condensed text-sm font-bold uppercase text-[#a3261b]">
        Rechazar comprobante
      </button>
    );
  }

  return (
    <form onSubmit={reject} className="basis-full space-y-2 border border-red-200 bg-red-50 p-3" aria-label="Rechazar comprobante">
      <p className="text-sm font-medium text-stone-900">¿Por qué lo rechazas? {buyerName} verá este motivo.</p>
      <div role="group" aria-label="Motivos frecuentes" className="flex flex-wrap gap-2">
        {REASONS.map((text) => (
          <button key={text} type="button" aria-pressed={reason === text} onClick={() => setReason(text)} className={`min-h-10 border px-3 text-sm ${reason === text ? "border-[#a3261b] bg-white text-[#a3261b]" : "border-stone-300 bg-white text-stone-800"}`}>{text}</button>
        ))}
      </div>
      <label htmlFor={`reject-${reservationId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Motivo</label>
      <input id={`reject-${reservationId}`} value={reason} maxLength={160} onChange={(event) => setReason(event.target.value)} className="min-h-11 w-full border border-stone-300 bg-white px-2 text-sm" />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || reason.trim().length < 3} className="min-h-11 bg-[#a3261b] px-4 font-condensed text-sm font-bold uppercase text-white disabled:opacity-50">{busy ? "Rechazando…" : "Rechazar"}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 text-sm text-stone-700 underline underline-offset-4">Cancelar</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
