"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { courierComplete, courierStep } from "@/app/recolectora/actions";

const button = "min-h-11 border-2 px-3 font-condensed text-sm font-bold uppercase disabled:opacity-40";

export function CourierDeliveryActions({ reservationId, deliveryStatus, buyerName }: { reservationId: string; deliveryStatus: string; buyerName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function step(action: "picked_up" | "on_the_way") {
    setBusy(true);
    setError(null);
    const result = await courierStep(reservationId, action);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  async function deliver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await courierComplete(reservationId, pin);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {deliveryStatus === "preparing" && <button type="button" disabled={busy} onClick={() => step("picked_up")} className={`${button} border-pine bg-pine text-white`}>Ya la recogí</button>}
        {(deliveryStatus === "preparing" || deliveryStatus === "picked_up") && <button type="button" disabled={busy} onClick={() => step("on_the_way")} className={`${button} border-pine text-pine`}>En camino</button>}
      </div>
      <form onSubmit={deliver} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`courier-pin-${reservationId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Código de entrega</label>
          <input id={`courier-pin-${reservationId}`} inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" className="mt-1 min-h-11 w-28 border border-stone-400 bg-white px-2 text-center text-lg tracking-[0.4em]" />
        </div>
        <button type="submit" disabled={busy || pin.length !== 4} className={`${button} border-pine bg-pine text-white`}>Marcar entregada</button>
        <p className="basis-full text-xs text-stone-600">{buyerName} te da este código al recibir sus prendas.</p>
      </form>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
