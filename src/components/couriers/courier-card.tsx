import { WEEKDAYS_SHORT } from "@/features/couriers/constants";
import type { CourierCard as CourierCardData } from "@/features/couriers/directory";
import { formatPriceMXN } from "@/features/products/format-price";

export function CourierCard({ courier, compact = false }: { courier: CourierCardData; compact?: boolean }) {
  return (
    <article className="border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-stone-900">{courier.fullName}</h3>
        <span className="bg-pine px-2 py-0.5 font-condensed text-xs font-bold uppercase text-white">✓ Verificada</span>
      </div>
      <p className="mt-1 text-sm text-stone-700">
        {courier.rating !== null ? <><span aria-hidden="true">★</span> {courier.rating.toFixed(1)} · </> : null}
        {courier.deliveries} {courier.deliveries === 1 ? "entrega" : "entregas"}
      </p>
      <p className="mt-2 text-sm text-stone-700"><strong>Recoge en:</strong> {courier.pointNames.join(", ") || "—"}</p>
      <p className="text-sm text-stone-700"><strong>Entrega en:</strong> {courier.municipalities.join(", ") || "—"}</p>
      {!compact && (
        <p className="text-sm text-stone-700"><strong>Días:</strong> {courier.days.map((day) => WEEKDAYS_SHORT[day]).join(", ") || "—"}{courier.timeWindow ? ` · ${courier.timeWindow}` : ""}</p>
      )}
      <p className="mt-2 font-semibold text-stone-900">{formatPriceMXN(courier.feeMxn)} por entrega</p>
    </article>
  );
}
