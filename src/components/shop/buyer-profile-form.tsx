"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBuyerProfile } from "@/features/shop/actions";

export function BuyerProfileForm({ fullName = "", facebookUrl = "", submitLabel = "Guardar" }: { fullName?: string; facebookUrl?: string; submitLabel?: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [facebook, setFacebook] = useState(facebookUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await saveBuyerProfile({ fullName: name, facebookUrl: facebook });
    setMessage(result.ok ? { ok: true, text: "Guardado." } : { ok: false, text: result.error });
    if (result.ok) router.refresh();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="buyer-name" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Tu nombre</label>
        <input id="buyer-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required autoComplete="name" className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900" />
      </div>
      <div>
        <label htmlFor="buyer-facebook" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Link de tu perfil de Facebook</label>
        <input id="buyer-facebook" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" value={facebook} onChange={(event) => setFacebook(event.target.value)} required placeholder="https://facebook.com/tu.nombre" className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900" />
      </div>
      <button type="submit" disabled={busy} className="min-h-12 bg-pine px-6 font-condensed text-base font-bold uppercase text-white disabled:opacity-60">{busy ? "Guardando…" : submitLabel}</button>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-pine" : "text-red-700"}`}>{message.text}</p>}
    </form>
  );
}
