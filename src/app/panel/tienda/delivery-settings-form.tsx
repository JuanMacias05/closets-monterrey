"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDeliverySettings } from "@/app/panel/tienda/actions";
import { MunicipalitySelect } from "@/components/shop/municipality-select";
import { PRIMARY_BUTTON_CLASS } from "@/components/panel/panel-styles";

export type DeliverySettingsProps = {
  points: { id: string; name: string }[];
  selectedPointIds: string[];
  homeDeliveryEnabled: boolean;
  // Where she ships from; "" until she picks it. Home delivery is priced from here.
  homeDeliveryOrigin: string;
  homeDeliveryNote: string;
  // On the garment screens the settings are store-wide, not part of the garment being edited.
  // Shown in full there, its own save button sat under "Crear prenda" and it wasn't clear which
  // button saved what; compact shows one summary line and opens the form on "Cambiar".
  compact?: boolean;
};

export function DeliverySettingsForm(props: DeliverySettingsProps) {
  const router = useRouter();
  const [pointIds, setPointIds] = useState(props.selectedPointIds);
  const [homeDelivery, setHomeDelivery] = useState(props.homeDeliveryEnabled);
  const [origin, setOrigin] = useState(props.homeDeliveryOrigin);
  const [homeNote, setHomeNote] = useState(props.homeDeliveryNote);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [expanded, setExpanded] = useState(!props.compact);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await saveDeliverySettings({ pointIds, homeDelivery, origin, homeNote });
    setMessage(result.ok ? { ok: true, text: "Entregas guardadas." } : { ok: false, text: result.error });
    if (result.ok) {
      router.refresh();
      if (props.compact) setExpanded(false);
    }
    setBusy(false);
  }

  if (!expanded) {
    const savedPoints = props.points.filter((point) => props.selectedPointIds.includes(point.id)).map((point) => point.name);
    // A switch left on from before zone rates, with no origin, is not offered to buyers; the
    // summary says so instead of claiming home delivery.
    const homePart = !props.homeDeliveryEnabled ? []
      : props.homeDeliveryOrigin ? [`envío a domicilio desde ${props.homeDeliveryOrigin}`]
      : ["envío a domicilio (falta elegir desde qué municipio envías)"];
    const parts = [...savedPoints, ...homePart];
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border border-stone-200 bg-white px-4 py-3 text-sm">
        <p className="min-w-0 text-stone-700">
          <span className="text-stone-500">Entregas (para todas tus prendas): </span>
          {parts.length ? parts.join(", ") : "se acuerdan por WhatsApp"}
        </p>
        <button type="button" onClick={() => setExpanded(true)} className="min-h-11 shrink-0 text-xs uppercase tracking-[0.12em] text-stone-700 underline underline-offset-4">Cambiar</button>
        {message?.ok && <p role="status" className="w-full text-sm text-pine">{message.text}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-labelledby="delivery-settings-title" className="space-y-5 border border-stone-200 bg-white p-5">
      <div>
        <h2 id="delivery-settings-title" className="font-condensed text-xl font-bold uppercase text-stone-900">Dónde entregas</h2>
        <p className="mt-1 text-sm text-stone-600">Aplica a todas tus prendas. Si no marcas nada, tu clientela acuerda la entrega contigo por WhatsApp.</p>
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
        {homeDelivery && !props.homeDeliveryOrigin && props.homeDeliveryEnabled && (
          <p className="bg-amber-50 p-3 text-sm text-amber-900">Tu clientela no ve el envío a domicilio hasta que elijas desde qué municipio envías.</p>
        )}
        {homeDelivery && (
          <div className="grid gap-4 sm:grid-cols-2">
            <MunicipalitySelect id="home-origin" label="¿Desde qué municipio envías?" value={origin} onChange={setOrigin} placeholder="Elige tu municipio" />
            <div>
              <label htmlFor="home-note" className="block text-xs text-stone-600">Zonas (opcional)</label>
              <input id="home-note" value={homeNote} onChange={(event) => setHomeNote(event.target.value)} maxLength={200} placeholder="Ej. Monterrey y San Nicolás" className="mt-1 min-h-11 w-full border-b border-stone-400 bg-transparent px-1 text-base" />
            </div>
            <p className="text-xs text-stone-600 sm:col-span-2">El costo del envío sale de las tarifas de BZRS Monterrey: tu cliente ve un precio aproximado según su municipio y el tuyo. Si su dirección queda lejos, puedes ajustarlo en Apartados antes de que te pague el anticipo.</p>
          </div>
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>{busy ? "Guardando…" : "Guardar entregas"}</button>
        {props.compact && <button type="button" onClick={() => setExpanded(false)} className="min-h-11 text-xs uppercase tracking-[0.12em] text-stone-600 underline underline-offset-4">Cancelar</button>}
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-pine" : "text-red-700"}`}>{message.text}</p>}
    </form>
  );
}
