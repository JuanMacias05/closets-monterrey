"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPersonActivities } from "@/features/accounts/people-actions";

// Grant or remove an existing person's activities. Removing selling or delivering suspends it
// (her products, reservations and ratings stay); an admin can't remove her own admin.
export function ActivitiesEditor({ personId, name, sell, deliver, administer, isSelf }: {
  personId: string; name: string; sell: boolean; deliver: boolean; administer: boolean; isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ sell, deliver, administer });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await setPersonActivities(personId, state);
    if (result.ok) { setOpen(false); router.refresh(); }
    else setError(result.error);
    setBusy(false);
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="min-h-10 border-2 border-stone-500 px-3 font-condensed text-sm font-bold uppercase text-stone-700">Actividades</button>;
  }
  const check = "flex min-h-10 items-center gap-2 text-sm text-stone-800";
  return (
    <div role="group" aria-label={`Actividades de ${name}`} className="space-y-2 border border-stone-300 bg-white p-3">
      <div className="flex flex-wrap gap-x-4">
        <label className={check}><input type="checkbox" checked={state.sell} onChange={(event) => setState({ ...state, sell: event.target.checked })} className="size-4 accent-pine" /> Vender</label>
        <label className={check}><input type="checkbox" checked={state.deliver} onChange={(event) => setState({ ...state, deliver: event.target.checked })} className="size-4 accent-pine" /> Entregar</label>
        <label className={check}><input type="checkbox" checked={state.administer} disabled={isSelf} onChange={(event) => setState({ ...state, administer: event.target.checked })} className="size-4 accent-pine" /> Administrar</label>
      </div>
      <div className="flex gap-3">
        <button type="button" disabled={busy} onClick={save} className="min-h-10 bg-pine px-3 font-condensed text-sm font-bold uppercase text-white disabled:opacity-60">{busy ? "Guardando…" : "Guardar"}</button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-10 text-sm text-stone-700 underline underline-offset-4">Cancelar</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
