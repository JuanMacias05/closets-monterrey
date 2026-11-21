"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustDeliveryFee } from "@/app/panel/apartados/actions";
import { formatPriceMXN } from "@/features/products/format-price";

const button = "min-h-11 border-2 px-3 font-condensed text-sm font-bold uppercase disabled:opacity-40";

// "Ajustar envío" on a home-delivery reservation. Only rendered while the buyer hasn't sent her
// deposit; the database enforces the same rule (adjust_delivery_fee).
export function DeliveryFeeAdjust({ reservationId, feeMxn, buyerName }: { reservationId: string; feeMxn: number; buyerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pesos, setPesos] = useState(String(feeMxn / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(`${buyerName} verá el nuevo costo del envío en su cuenta. Avísale por WhatsApp. ¿Guardar?`)) return;
    setBusy(true);
    setError(null);
    const result = await adjustDeliveryFee(reservationId, pesos);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${button} border-stone-500 text-stone-700`}>
        Ajustar envío
      </button>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`fee-${reservationId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Nuevo costo del envío (MXN)</label>
        <input
          id={`fee-${reservationId}`}
          type="number"
          min="0"
          max="1000"
          step="1"
          inputMode="numeric"
          value={pesos}
          onChange={(event) => setPesos(event.target.value)}
          className="mt-1 min-h-11 w-32 border border-stone-400 bg-white px-2 text-base"
        />
      </div>
      <button type="submit" disabled={busy} className={`${button} border-pine bg-pine text-white`}>{busy ? "Guardando…" : "Guardar envío"}</button>
      <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null); setPesos(String(feeMxn / 100)); }} className="min-h-11 px-2 text-xs uppercase tracking-[0.12em] text-stone-600 underline underline-offset-4">Cancelar</button>
      <p className="basis-full text-xs text-stone-600">Ahora: {formatPriceMXN(feeMxn)}. Solo se puede cambiar antes de que {buyerName} te mande su anticipo.</p>
      {error && <p role="alert" className="basis-full text-xs text-red-700">{error}</p>}
    </form>
  );
}
