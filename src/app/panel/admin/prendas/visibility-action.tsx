"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAdminProductVisibility } from "@/app/panel/admin/prendas/actions";

export function VisibilityAction({ productId, hidden }: { productId: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const result = await setAdminProductVisibility(productId, !hidden);
    if (!result.ok) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <div>
      <button type="button" onClick={toggle} disabled={busy} className="min-h-10 border-b border-stone-500 px-1 text-left text-xs uppercase tracking-[0.12em] text-stone-700 disabled:opacity-50">
        {busy ? "Guardando…" : hidden ? "Mostrar en catálogo" : "Ocultar del catálogo"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
