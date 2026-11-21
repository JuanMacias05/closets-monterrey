"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCourierRoute } from "@/app/recolectora/actions";
import { MUNICIPALITIES, WEEKDAYS } from "@/features/couriers/constants";

type Props = {
  municipalities: string[]; days: number[]; timeWindow: string;
  pointIds: string[]; points: { id: string; name: string }[];
};

function toggle<T>(list: T[], value: T, on: boolean) {
  return on ? [...list, value] : list.filter((item) => item !== value);
}

// Where she collects, where she delivers and when. Her fee lives in "Mi perfil".
export function CourierRouteForm(props: Props) {
  const router = useRouter();
  const [municipalities, setMunicipalities] = useState(props.municipalities);
  const [days, setDays] = useState(props.days);
  const [timeWindow, setTimeWindow] = useState(props.timeWindow);
  const [pointIds, setPointIds] = useState(props.pointIds);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await saveCourierRoute({ municipalities, days, timeWindow, pointIds });
    setMessage(result.ok ? { ok: true, text: "Ruta guardada." } : { ok: false, text: result.error });
    if (result.ok) router.refresh();
    setBusy(false);
  }

  const check = "flex min-h-11 items-center gap-3 text-sm text-stone-800";
  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="text-xs uppercase tracking-[0.14em] text-stone-600">Dónde recoges (puntos fijos)</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {props.points.map((point) => (
            <label key={point.id} className={check}>
              <input type="checkbox" checked={pointIds.includes(point.id)} onChange={(event) => setPointIds(toggle(pointIds, point.id, event.target.checked))} className="size-4 accent-pine" />
              {point.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs uppercase tracking-[0.14em] text-stone-600">Municipios donde entregas</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {MUNICIPALITIES.map((name) => (
            <label key={name} className={check}>
              <input type="checkbox" checked={municipalities.includes(name)} onChange={(event) => setMunicipalities(toggle(municipalities, name, event.target.checked))} className="size-4 accent-pine" />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs uppercase tracking-[0.14em] text-stone-600">Días de entrega</legend>
        <div className="mt-2 flex flex-wrap gap-x-5">
          {WEEKDAYS.map((name, index) => (
            <label key={name} className={check}>
              <input type="checkbox" checked={days.includes(index)} onChange={(event) => setDays(toggle(days, index, event.target.checked))} className="size-4 accent-pine" />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:max-w-xs">
        <label htmlFor="courier-window" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Horario</label>
        <input id="courier-window" value={timeWindow} onChange={(event) => setTimeWindow(event.target.value)} maxLength={60} placeholder="5:00 a 9:00 PM" className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base" />
      </div>
      <button type="submit" disabled={busy} className="min-h-12 bg-pine px-6 font-condensed text-base font-bold uppercase text-white disabled:opacity-60">{busy ? "Guardando…" : "Guardar mi ruta"}</button>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-pine" : "text-red-700"}`}>{message.text}</p>}
    </form>
  );
}
