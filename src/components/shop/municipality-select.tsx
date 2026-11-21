import { MUNICIPALITIES } from "@/features/couriers/constants";

// The metro-area municipality picker. One component for every place that asks for it (the
// buyer's municipality for a courier or for home delivery, the seller's origin), so the list
// and its look can't drift apart.
export function MunicipalitySelect({ id, label, value, onChange, placeholder = "Elige tu municipio" }: {
  id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs uppercase tracking-[0.14em] text-stone-600">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full border border-stone-300 bg-white px-2 text-sm">
        <option value="">{placeholder}</option>
        {MUNICIPALITIES.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </div>
  );
}
