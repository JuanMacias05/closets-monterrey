"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCourierStatus } from "@/app/panel/admin/recolectoras/actions";

export function CourierStatusActions({ courierId, name, status }: { courierId: string; name: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(next: "approved" | "suspended", confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const result = await setCourierStatus(courierId, next);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }
  const button = "min-h-10 border-2 px-3 font-condensed text-sm font-bold uppercase disabled:opacity-40";
  return (
    <div>
      {status !== "approved" && <button type="button" disabled={busy} onClick={() => run("approved", `¿Ya verificaste en persona la identificación de ${name}? Aparecerá con su identidad verificada.`)} className={`${button} border-pine bg-pine text-white`}>Verificar</button>}
      {status === "approved" && <button type="button" disabled={busy} onClick={() => run("suspended", `¿Suspender a ${name}? Deja de aparecer para la clientela.`)} className={`${button} border-[#a3261b] text-[#a3261b]`}>Suspender</button>}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
