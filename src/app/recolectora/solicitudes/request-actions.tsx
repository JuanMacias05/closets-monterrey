"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptCourierRequest, rejectCourierRequest } from "@/app/recolectora/actions";
import { COURIER_REJECT_REASONS } from "@/features/couriers/constants";

const button = "min-h-11 border-2 px-4 font-condensed text-sm font-bold uppercase disabled:opacity-40";

// Aceptar / Rechazar for one waiting request. A reason is optional: the buyer sees it if given.
export function CourierRequestActions({ requestId, storeName }: { requestId: string; storeName: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    if (result.ok) router.refresh();
    else setError(result.error ?? "No pudimos guardar tu respuesta.");
    setBusy(false);
  }

  if (!rejecting) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => run(() => acceptCourierRequest(requestId))} className={`${button} border-pine bg-pine text-white`}>{busy ? "Guardando…" : "Aceptar"}</button>
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className={`${button} border-[#a3261b] text-[#a3261b]`}>Rechazar</button>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); run(() => rejectCourierRequest(requestId, reason)); }}
      aria-label={`Rechazar la entrega de ${storeName}`}
      className="space-y-2 border border-red-200 bg-red-50 p-3"
    >
      <p className="text-sm font-medium text-stone-900">¿Por qué no puedes? Es opcional; tu cliente verá tu motivo.</p>
      <div role="group" aria-label="Motivos frecuentes" className="flex flex-wrap gap-2">
        {COURIER_REJECT_REASONS.map((text) => (
          <button key={text} type="button" aria-pressed={reason === text} onClick={() => setReason(reason === text ? "" : text)} className={`min-h-10 border px-3 text-sm ${reason === text ? "border-[#a3261b] bg-white text-[#a3261b]" : "border-stone-300 bg-white text-stone-800"}`}>{text}</button>
        ))}
      </div>
      <label htmlFor={`reject-${requestId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Motivo (opcional)</label>
      <input id={`reject-${requestId}`} value={reason} maxLength={160} onChange={(event) => setReason(event.target.value)} className="min-h-11 w-full border border-stone-300 bg-white px-2 text-sm" />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="min-h-11 bg-[#a3261b] px-4 font-condensed text-sm font-bold uppercase text-white disabled:opacity-50">{busy ? "Rechazando…" : "Rechazar entrega"}</button>
        <button type="button" disabled={busy} onClick={() => setRejecting(false)} className="min-h-11 text-sm text-stone-700 underline underline-offset-4">Volver</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
