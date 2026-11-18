"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTrustOverride } from "@/app/panel/admin/clientas/actions";

export function TrustOverrideSelect({ buyerId, buyerName, value }: { buyerId: string; buyerName: string; value: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    setBusy(true);
    setError(null);
    const result = await setTrustOverride(buyerId, next === "auto" ? null : (next as "green" | "yellow" | "red"));
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  return (
    <div>
      <label className="sr-only" htmlFor={`trust-${buyerId}`}>Semáforo de {buyerName}</label>
      <select id={`trust-${buyerId}`} value={value ?? "auto"} disabled={busy} onChange={(event) => change(event.target.value)} className="min-h-11 border border-stone-400 bg-white px-2 text-sm">
        <option value="auto">Automático</option>
        <option value="green">Confiable (verde)</option>
        <option value="yellow">Precaución (amarillo)</option>
        <option value="red">No confiable (rojo)</option>
      </select>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
