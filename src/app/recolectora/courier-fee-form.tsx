"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCourierFee } from "@/app/recolectora/actions";

// One flat fee per delivery: what buyers see next to her name when they pick a courier.
export function CourierFeeForm({ feeMxn }: { feeMxn: number }) {
  const router = useRouter();
  const [fee, setFee] = useState(String(feeMxn / 100));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await saveCourierFee(fee);
    setMessage(result.ok ? { ok: true, text: "Tarifa guardada." } : { ok: false, text: result.error });
    if (result.ok) router.refresh();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="w-40">
        <label htmlFor="courier-fee" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Tarifa por entrega (MXN)</label>
        <input id="courier-fee" type="number" min="0" step="5" inputMode="numeric" value={fee} onChange={(event) => setFee(event.target.value)} className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base" />
      </div>
      <button type="submit" disabled={busy} className="min-h-12 bg-pine px-6 font-condensed text-base font-bold uppercase text-white disabled:opacity-60">{busy ? "Guardando…" : "Guardar tarifa"}</button>
      {message && <p role={message.ok ? "status" : "alert"} className={`basis-full text-sm ${message.ok ? "text-pine" : "text-red-700"}`}>{message.text}</p>}
    </form>
  );
}
