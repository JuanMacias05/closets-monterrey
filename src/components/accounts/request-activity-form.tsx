"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestActivities } from "@/features/accounts/activity-actions";

// "Enviar solicitud" on Quiero vender / Quiero entregar.
export function RequestActivityForm({ activity, suggestedName }: { activity: "sell" | "deliver"; suggestedName: string }) {
  const router = useRouter();
  const [name, setName] = useState(activity === "deliver" ? suggestedName : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await requestActivities(activity === "sell" ? { sell: true, deliver: false, storeName: name } : { sell: false, deliver: true, fullName: name });
    if (result.ok) router.push(activity === "sell" ? "/panel" : "/recolectora/ruta");
    else setError(result.error);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="activity-name" className="block text-xs uppercase tracking-[0.14em] text-stone-600">{activity === "sell" ? "Nombre de tu bazar" : "Tu nombre completo"}</label>
        <input id="activity-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={activity === "sell" ? 60 : 80} required placeholder={activity === "sell" ? "El bazar de Ana" : "Guadalupe Martínez"} className="mt-1 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900 sm:max-w-sm" />
      </div>
      <button type="submit" disabled={busy} className="press min-h-12 bg-pine px-6 font-condensed text-base font-bold uppercase text-white disabled:opacity-60">{busy ? "Enviando…" : "Enviar solicitud"}</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
