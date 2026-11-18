"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProductSaleStatus } from "@/app/panel/prendas/actions";

export function ProductListActions({ productId, saleStatus }: { productId: string; saleStatus: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextStatus = saleStatus === "sold" ? "available" : "sold";

  async function toggleSold() {
    setBusy(true);
    setError(null);
    const result = await setProductSaleStatus(productId, nextStatus);
    if (!result.ok) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <div>
      <button type="button" onClick={toggleSold} disabled={busy} className="min-h-10 border-b border-stone-500 px-1 text-left text-xs uppercase tracking-[0.12em] text-stone-700 disabled:opacity-40">
        {busy ? "Guardando…" : saleStatus === "sold" ? "Volver a disponible" : "Marcar como vendida"}
      </button>
      {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
