"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MUNICIPALITIES } from "@/features/couriers/constants";
import { formatPriceMXN } from "@/features/products/format-price";
import { reserveFromSeller, type DeliveryChoice } from "@/features/shop/actions";

export type CourierOption = {
  id: string; fullName: string; municipalities: string[]; feeMxn: number; feeLabel: string;
  pointNames: string[]; rating: number | null; deliveries: number;
};

export type SellerDeliveryOptions = {
  points: { id: string; name: string }[];
  homeDelivery: { feeLabel: string; note: string | null } | null;
  // Couriers who collect at one of this seller's points; filtered by municipality below.
  couriers: CourierOption[];
};

// Delivery choice + "Apartar" for one seller's group in the cart. When the seller offers no
// point and no home delivery, the only path is arranging it with her on WhatsApp.
export function ReserveButton({ sellerId, storeName, depositMxn, disabled, options }: {
  sellerId: string; storeName: string; depositMxn: number; disabled: boolean; options: SellerDeliveryOptions;
}) {
  const router = useRouter();
  const offersSomething = options.points.length > 0 || options.homeDelivery !== null;
  const [choice, setChoice] = useState<string>(options.points[0] ? `point:${options.points[0].id}` : options.homeDelivery ? "home" : "arranged");
  const [address, setAddress] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [courierId, setCourierId] = useState("");
  const [feePayment, setFeePayment] = useState<"on_delivery" | "with_deposit">("on_delivery");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupName = `delivery-${sellerId}`;

  const couriersHere = options.couriers.filter((courier) => courier.municipalities.includes(municipality));
  const chosenCourier = couriersHere.find((courier) => courier.id === courierId);
  // With "incluida en el anticipo" the courier fee travels with the deposit to the seller.
  const totalDeposit = depositMxn + (choice === "courier" && chosenCourier && feePayment === "with_deposit" ? chosenCourier.feeMxn : 0);
  const depositLabel = formatPriceMXN(totalDeposit);

  function delivery(): DeliveryChoice {
    if (choice === "home") return { method: "home_delivery", address };
    if (choice === "courier") return { method: "courier", courierId, municipality, address, feePayment };
    if (choice.startsWith("point:")) return { method: "pickup_point", pointId: choice.slice("point:".length) };
    return { method: "arranged" };
  }

  async function reserve() {
    if ((choice === "home" || choice === "courier") && address.trim().length < 10) {
      setError("Escribe tu dirección completa (calle, número, colonia y municipio).");
      return;
    }
    if (choice === "courier" && !chosenCourier) {
      setError("Elige tu municipio y una recolectora.");
      return;
    }
    if (!window.confirm(`Vas a apartar estas prendas de ${storeName}. Tienes 24 horas para transferir el anticipo de ${depositLabel}; si no, se liberan. ¿Continuar?`)) return;
    setBusy(true);
    setError(null);
    const result = await reserveFromSeller(sellerId, delivery());
    if (result.ok) {
      router.push(`/cuenta#apartado-${result.reservationId}`);
      router.refresh();
    } else {
      setError(result.error);
      router.refresh();
    }
    setBusy(false);
  }

  const radio = "flex min-h-11 items-center gap-3 text-sm text-stone-800";

  return (
    <div className="flex w-full flex-col gap-4">
      <fieldset>
        <legend className="font-condensed text-base font-bold uppercase text-stone-900">¿Cómo la recibes?</legend>
        {offersSomething ? (
          <div className="mt-2 flex flex-col">
            {options.points.map((point) => (
              <label key={point.id} className={radio}>
                <input type="radio" name={groupName} value={`point:${point.id}`} checked={choice === `point:${point.id}`} onChange={(event) => setChoice(event.target.value)} className="size-4 accent-pine" />
                <span>Punto fijo: <strong>{point.name}</strong> <span className="text-stone-600">· sin costo</span></span>
              </label>
            ))}
            {options.homeDelivery && (
              <label className={radio}>
                <input type="radio" name={groupName} value="home" checked={choice === "home"} onChange={(event) => setChoice(event.target.value)} className="size-4 accent-pine" />
                <span>Envío a domicilio · <strong>{options.homeDelivery.feeLabel}</strong>{options.homeDelivery.note ? <span className="text-stone-600"> ({options.homeDelivery.note})</span> : null}</span>
              </label>
            )}
            {options.couriers.length > 0 && (
              <label className={radio}>
                <input type="radio" name={groupName} value="courier" checked={choice === "courier"} onChange={(event) => setChoice(event.target.value)} className="size-4 accent-pine" />
                <span>Recolectora verificada <span className="text-stone-600">· te la lleva a tu municipio</span></span>
              </label>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-700">Esta vendedora acuerda la entrega contigo por WhatsApp después de apartar.</p>
        )}

        {choice === "courier" && (
          <div className="mt-3 space-y-3 border-l-2 border-pine pl-4">
            <div>
              <label htmlFor={`municipality-${sellerId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Tu municipio</label>
              <select id={`municipality-${sellerId}`} value={municipality} onChange={(event) => { setMunicipality(event.target.value); setCourierId(""); }} className="mt-1 min-h-11 w-full border border-stone-300 bg-white px-2 text-sm">
                <option value="">Elige tu municipio</option>
                {MUNICIPALITIES.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            {municipality && couriersHere.length === 0 && <p className="text-sm text-stone-700">Ninguna recolectora cubre {municipality} para esta vendedora todavía.</p>}
            {couriersHere.length > 0 && (
              <fieldset>
                <legend className="text-xs uppercase tracking-[0.14em] text-stone-600">Recolectora</legend>
                {couriersHere.map((courier) => (
                  <label key={courier.id} className={radio}>
                    <input type="radio" name={`courier-${sellerId}`} value={courier.id} checked={courierId === courier.id} onChange={(event) => setCourierId(event.target.value)} className="size-4 accent-pine" />
                    <span><strong>{courier.fullName}</strong> ✓ · {courier.feeLabel}{courier.rating !== null ? ` · ★ ${courier.rating.toFixed(1)}` : ""} <span className="text-stone-600">· recoge en {courier.pointNames.join(", ")}</span></span>
                  </label>
                ))}
              </fieldset>
            )}
            {chosenCourier && (
              <fieldset>
                <legend className="text-xs uppercase tracking-[0.14em] text-stone-600">¿Cómo pagas la tarifa de {chosenCourier.feeLabel}?</legend>
                <label className={radio}>
                  <input type="radio" name={`fee-${sellerId}`} checked={feePayment === "on_delivery"} onChange={() => setFeePayment("on_delivery")} className="size-4 accent-pine" />
                  A la recolectora al recibir (efectivo o transferencia)
                </label>
                <label className={radio}>
                  <input type="radio" name={`fee-${sellerId}`} checked={feePayment === "with_deposit"} onChange={() => setFeePayment("with_deposit")} className="size-4 accent-pine" />
                  Incluida en mi anticipo a la vendedora
                </label>
              </fieldset>
            )}
          </div>
        )}

        {(choice === "home" || choice === "courier") && (
          <div className="mt-3">
            <label htmlFor={`address-${sellerId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Dirección de entrega</label>
            <textarea id={`address-${sellerId}`} value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} rows={2} placeholder="Calle, número, colonia y municipio" className="mt-1 w-full border border-stone-300 bg-white p-2 text-sm" />
            {choice === "home" && <p className="text-xs text-stone-600">El envío se paga en la entrega, junto con el resto.</p>}
          </div>
        )}
      </fieldset>
      <button type="button" onClick={reserve} disabled={disabled || busy} className="min-h-12 w-full bg-pine px-6 font-condensed text-base font-bold uppercase text-white disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 sm:w-auto sm:self-end">
        {busy ? "Apartando…" : `Apartar · anticipo ${depositLabel}`}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
