"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeWithPin, updateSellerReservation, type SellerReservationAction } from "@/app/panel/apartados/actions";

const button = "min-h-11 border-2 px-3 font-condensed text-sm font-bold uppercase disabled:opacity-40";

export function ReservationActions({ reservationId, status, deliveryStatus, buyerName }: {
  reservationId: string; status: string; deliveryStatus: string; buyerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(action: SellerReservationAction, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const result = await updateSellerReservation(reservationId, action);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  async function deliver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await completeWithPin(reservationId, pin);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  if (status !== "pending_deposit" && status !== "confirmed") return null;

  return (
    <div className="space-y-3">
      {status === "confirmed" && (
        <form onSubmit={deliver} className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={`pin-${reservationId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Código de entrega</label>
            <input
              id={`pin-${reservationId}`}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              className="mt-1 min-h-11 w-28 border border-stone-400 bg-white px-2 text-center text-lg tracking-[0.4em]"
            />
          </div>
          <button type="submit" disabled={busy || pin.length !== 4} className={`${button} border-pine bg-pine text-white`}>Marcar entregada</button>
          <p className="basis-full text-xs text-stone-600">Pídele a {buyerName} el código de 4 dígitos que ve en su cuenta al recibir.</p>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "pending_deposit" && (
          <button type="button" disabled={busy} onClick={() => run("confirm", `¿Ya te llegó el anticipo de ${buyerName}? Revisa tu banco antes de confirmar.`)} className={`${button} border-pine bg-pine text-white`}>Confirmar anticipo</button>
        )}
        {status === "confirmed" && deliveryStatus === "preparing" && (
          <button type="button" disabled={busy} onClick={() => run("on_the_way")} className={`${button} border-pine text-pine`}>En camino</button>
        )}
        <button type="button" disabled={busy} onClick={() => run("cancel", "¿Cancelar este apartado? Las prendas vuelven a estar disponibles.")} className={`${button} border-stone-500 text-stone-700`}>Cancelar</button>
        <button type="button" disabled={busy} onClick={() => run("no_show", `¿${buyerName} te quedó mal? Las prendas se liberan y su semáforo pasa a rojo.`)} className={`${button} border-[#a3261b] text-[#a3261b]`}>Me quedó mal</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
