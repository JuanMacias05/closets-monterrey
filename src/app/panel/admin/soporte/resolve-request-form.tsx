"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveSupportRequest } from "@/app/panel/admin/soporte/actions";

export function ResolveRequestForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await resolveSupportRequest(requestId, note);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  return (
    <form onSubmit={resolve} className="space-y-2" aria-label="Resolver solicitud">
      <label htmlFor={`resolve-${requestId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Cómo se resolvió (opcional)</label>
      <input id={`resolve-${requestId}`} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Ej.: la tienda confirmó que sí le llegó" className="min-h-11 w-full border border-stone-300 bg-white px-2 text-sm" />
      <button type="submit" disabled={busy} className="min-h-11 bg-pine px-4 font-condensed text-sm font-bold uppercase text-white disabled:opacity-60">{busy ? "Guardando…" : "Marcar resuelta"}</button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
