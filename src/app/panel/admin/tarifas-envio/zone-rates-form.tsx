"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveZoneRates } from "@/app/panel/admin/tarifas-envio/actions";
import { PRIMARY_BUTTON_CLASS } from "@/components/panel/panel-styles";

// One origin's prices, one row per destination. A list instead of a 9×9 matrix: on a phone a
// matrix needs sideways scrolling and loses which row is which.
export function ZoneRatesForm({ origin, fees }: { origin: string; fees: { destination: string; pesos: string }[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fees.map((fee) => [fee.destination, fee.pesos])));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await saveZoneRates(origin, values);
    setMessage(result.ok ? { ok: true, text: `Tarifas desde ${origin} guardadas.` } : { ok: false, text: result.error });
    if (result.ok) router.refresh();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} aria-labelledby="zone-rates-title" className="border border-stone-200 bg-white p-5">
      <h2 id="zone-rates-title" className="font-condensed text-xl font-bold uppercase text-stone-900">Envíos desde {origin}</h2>
      <p className="mt-1 text-sm text-stone-600">Precio en pesos hasta el municipio de la clienta.</p>
      <ul className="mt-4 divide-y divide-stone-200">
        {fees.map(({ destination }) => (
          <li key={destination} className="flex min-h-14 items-center justify-between gap-3 py-2">
            <span className="min-w-0 text-sm text-stone-900">
              {destination}
              {destination === origin && <span className="text-stone-500"> · mismo municipio</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm text-stone-600">
              $
              <input
                type="number"
                min="0"
                max="1000"
                step="1"
                inputMode="numeric"
                required
                aria-label={`Envío de ${origin} a ${destination}, en pesos`}
                value={values[destination] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [destination]: event.target.value }))}
                className="min-h-11 w-24 border border-stone-400 bg-white px-2 text-right text-base text-stone-900"
              />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>{busy ? "Guardando…" : `Guardar tarifas desde ${origin}`}</button>
        {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-pine" : "text-red-700"}`}>{message.text}</p>}
      </div>
    </form>
  );
}
