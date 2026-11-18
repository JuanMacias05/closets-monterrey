"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAccount } from "@/app/panel/admin/vendedoras/actions";

type Props = { accountId: string; storeName: string; role: string; status: string; isSelf: boolean };

export function AccountActions({ accountId, storeName, role, status, isSelf }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(change: Parameters<typeof updateAccount>[1], confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const result = await updateAccount(accountId, change);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  const button = "min-h-10 border-2 px-3 font-condensed text-sm font-bold uppercase disabled:opacity-40";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && (
          <button type="button" disabled={busy} onClick={() => run({ status: "approved" })} className={`${button} border-pine bg-pine text-white`}>Aprobar</button>
        )}
        {status === "approved" && !isSelf && (
          <button type="button" disabled={busy} onClick={() => run({ status: "suspended" }, `¿Suspender a "${storeName}"? Sus prendas dejan de verse en la tienda.`)} className={`${button} border-[#a3261b] text-[#a3261b]`}>Suspender</button>
        )}
        {role !== "admin" && (
          <button type="button" disabled={busy} onClick={() => run({ role: "admin" }, `¿Hacer admin a "${storeName}"? Podrá aprobar cuentas y ocultar prendas de cualquiera.`)} className={`${button} border-pine text-pine`}>Hacer admin</button>
        )}
        {role === "admin" && !isSelf && (
          <button type="button" disabled={busy} onClick={() => run({ role: "seller" }, `¿Quitar el rol de admin a "${storeName}"?`)} className={`${button} border-stone-500 text-stone-700`}>Quitar admin</button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
