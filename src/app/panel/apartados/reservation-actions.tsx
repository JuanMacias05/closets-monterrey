"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSellerReservation, type SellerReservationAction } from "@/app/panel/apartados/actions";

const button = "min-h-11 border-2 px-3 font-condensed text-sm font-bold uppercase disabled:opacity-40";

export function ReservationActions({ reservationId, status, buyerName }: { reservationId: string; status: string; buyerName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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

  if (status !== "pending_deposit" && status !== "confirmed") return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "pending_deposit" && (
          <button type="button" disabled={busy} onClick={() => run("confirm", `¿Ya te llegó el anticipo de ${buyerName}? Revisa tu banco antes de confirmar.`)} className={`${button} border-pine bg-pine text-white`}>Confirmar anticipo</button>
        )}
        {status === "confirmed" && (
          <button type="button" disabled={busy} onClick={() => run("complete", "¿Ya entregaste las prendas y cobraste el resto? Quedarán como vendidas.")} className={`${button} border-pine bg-pine text-white`}>Marcar entregada</button>
        )}
        <button type="button" disabled={busy} onClick={() => run("cancel", "¿Cancelar este apartado? Las prendas vuelven a estar disponibles.")} className={`${button} border-stone-500 text-stone-700`}>Cancelar</button>
        <button type="button" disabled={busy} onClick={() => run("no_show", `¿${buyerName} te quedó mal? Las prendas se liberan y su semáforo pasa a rojo.`)} className={`${button} border-[#a3261b] text-[#a3261b]`}>Me quedó mal</button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
