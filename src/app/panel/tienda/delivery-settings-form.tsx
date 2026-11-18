"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDeliverySettings } from "@/app/panel/tienda/actions";

export type DeliverySettingsProps = {
  points: { id: string; name: string }[];
  selectedPointIds: string[];
  homeDeliveryEnabled: boolean;
  homeDeliveryFeeMxn: number;
  homeDeliveryNote: string;
};

export function DeliverySettingsForm(props: DeliverySettingsProps) {
  const router = useRouter();
  const [pointIds, setPointIds] = useState(props.selectedPointIds);
  const [homeDelivery, setHomeDelivery] = useState(props.homeDeliveryEnabled);
  const [homeFee, setHomeFee] = useState(String(props.homeDeliveryFeeMxn / 100));
  const [homeNote, setHomeNote] = useState(props.homeDeliveryNote);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await saveDeliverySettings({ pointIds, homeDelivery, homeFee, homeNote });
    setMessage(result.ok ? { ok: true, text: "Entregas guardadas." } : { ok: false, text: result.error });
    if (result.ok) router.refresh();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} aria-labelledby="delivery-settings-title" className="space-y-5 border border-stone-200 bg-white p-5">
      <div>
        <h2 id="delivery-settings-title" className="font-condensed text-xl font-bold uppercase text-stone-900">Dónde entregas</h2>
        <p className="mt-1 text-sm text-stone-600">Aplica a todas tus prendas. Si no marcas nada, tus clientas acuerdan la entrega contigo por WhatsApp.</p>
      </div>
      <fieldset>
        <legend className="block text-xs uppercase tracking-[0.16em] text-stone-600">Puntos fijos a los que llegas</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {props.points.map((point) => (
            <label key={point.id} className="flex min-h-11 items-center gap-3 text-sm text-stone-800">
              <input type="checkbox" checked={pointIds.includes(point.id)} onChange={(event) => setPointIds((current) => event.target.checked ? [...current, point.id] : current.filter((id) => id !== point.id))} className="size-4 accent-pine" />
              {point.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="block text-xs uppercase tracking-[0.16em] text-stone-600">Envío a domicilio</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm text-stone-800">
          <input type="checkbox" checked={homeDelivery} onChange={(event) => setHomeDelivery(event.target.checked)} className="size-4 accent-pine" />
          Ofrezco envío a domicilio
        </label>
        {homeDelivery && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="home-fee" className="block text-xs text-stone-600">Costo del envío (MXN)</label>
              <input id="home-fee" type="number" min="0" step="5" inputMode="numeric" value={homeFee} onChange={(event) => setHomeFee(event.target.value)} className="mt-1 min-h-11 w-full border-b border-stone-400 bg-transparent px-1 text-base" />
            </div>
            <div>
              <label htmlFor="home-note" className="block text-xs text-stone-600">Zonas (opcional)</label>
              <input id="home-note" value={homeNote} onChange={(event) => setHomeNote(event.target.value)} maxLength={200} placeholder="Ej. Monterrey y San Nicolás" className="mt-1 min-h-11 w-full border-b border-stone-400 bg-transparent px-1 text-base" />
            </div>
          </div>
        )}
      </fieldset>
      <button type="submit" disabled={busy} className="min-h-12 bg-pine px-6 font-condensed text-base font-bold uppercase text-white disabled:opacity-60">{busy ? "Guardando…" : "Guardar entregas"}</button>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-pine" : "text-red-700"}`}>{message.text}</p>}
    </form>
  );
}
