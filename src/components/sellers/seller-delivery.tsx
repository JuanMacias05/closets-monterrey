import { formatPriceMXN } from "@/features/products/format-price";
import type { SellerDelivery } from "@/features/sellers/seller-storefront";

// Where a seller hands garments over. With nothing set up, buyers and seller agree on
// WhatsApp, and saying so beats an empty section.
export function SellerDeliveryList({ delivery }: { delivery: SellerDelivery }) {
  if (delivery.points.length === 0 && !delivery.home) {
    return <p className="text-sm text-stone-700">La entrega se acuerda por WhatsApp al apartar.</p>;
  }
  return (
    <ul className="space-y-2 text-sm text-stone-800">
      {delivery.points.map((point) => (
        <li key={point} className="flex items-start gap-2">
          <PinIcon />
          <span><span className="text-stone-500">Punto fijo:</span> {point} <span className="text-stone-500">· sin costo</span></span>
        </li>
      ))}
      {delivery.home && (
        <li className="flex items-start gap-2">
          <HomeIcon />
          <span>
            <span className="text-stone-500">A domicilio desde {delivery.home.origin}:</span>{" "}
            {delivery.home.minFeeMxn === delivery.home.maxFeeMxn
              ? formatPriceMXN(delivery.home.minFeeMxn)
              : `${formatPriceMXN(delivery.home.minFeeMxn)} a ${formatPriceMXN(delivery.home.maxFeeMxn)}`}
            <span className="text-stone-500"> según tu municipio</span>
            {delivery.home.note && <span className="text-stone-500"> · {delivery.home.note}</span>}
          </span>
        </li>
      )}
    </ul>
  );
}

function PinIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-pine"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

function HomeIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-pine"><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></svg>;
}
