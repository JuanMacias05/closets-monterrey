"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelMyReservation } from "@/features/shop/actions";

export function CancelReservationButton({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel() {
    if (!window.confirm("¿Cancelar este apartado? Las prendas se liberan para otras personas.")) return;
    setBusy(true);
    const result = await cancelMyReservation(reservationId);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }
  return (
    <div>
      <button type="button" onClick={cancel} disabled={busy} className="min-h-11 text-sm text-[#a3261b] underline underline-offset-4 disabled:opacity-50">{busy ? "Cancelando…" : "Cancelar apartado"}</button>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
