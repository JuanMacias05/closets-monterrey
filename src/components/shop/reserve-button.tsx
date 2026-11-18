"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reserveFromSeller } from "@/features/shop/actions";

export function ReserveButton({ sellerId, storeName, depositLabel, disabled }: { sellerId: string; storeName: string; depositLabel: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reserve() {
    if (!window.confirm(`Vas a apartar estas prendas de ${storeName}. Tienes 24 horas para transferir el anticipo de ${depositLabel}; si no, se liberan. ¿Continuar?`)) return;
    setBusy(true);
    setError(null);
    const result = await reserveFromSeller(sellerId);
    if (result.ok) {
      router.push(`/cuenta#apartado-${result.reservationId}`);
      router.refresh();
    } else {
      setError(result.error);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div>
      <button type="button" onClick={reserve} disabled={disabled || busy} className="min-h-12 w-full bg-pine px-6 font-condensed text-base font-bold uppercase text-white disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 sm:w-auto">
        {busy ? "Apartando…" : `Apartar · anticipo ${depositLabel}`}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
