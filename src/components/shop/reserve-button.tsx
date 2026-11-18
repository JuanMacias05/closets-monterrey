"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reserveFromSeller, type DeliveryChoice } from "@/features/shop/actions";

export type SellerDeliveryOptions = {
  points: { id: string; name: string }[];
  homeDelivery: { feeLabel: string; note: string | null } | null;
};

// Delivery choice + "Apartar" for one seller's group in the cart. When the seller offers no
// point and no home delivery, the only path is arranging it with her on WhatsApp.
export function ReserveButton({ sellerId, storeName, depositLabel, disabled, options }: {
  sellerId: string; storeName: string; depositLabel: string; disabled: boolean; options: SellerDeliveryOptions;
}) {
  const router = useRouter();
  const offersSomething = options.points.length > 0 || options.homeDelivery !== null;
  const [choice, setChoice] = useState<string>(options.points[0] ? `point:${options.points[0].id}` : options.homeDelivery ? "home" : "arranged");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupName = `delivery-${sellerId}`;

  function delivery(): DeliveryChoice {
    if (choice === "home") return { method: "home_delivery", address };
    if (choice.startsWith("point:")) return { method: "pickup_point", pointId: choice.slice("point:".length) };
    return { method: "arranged" };
  }

  async function reserve() {
    if (choice === "home" && address.trim().length < 10) {
      setError("Escribe tu dirección completa (calle, número, colonia y municipio).");
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

  return (
    <div className="flex w-full flex-col gap-4">
      <fieldset>
        <legend className="font-condensed text-base font-bold uppercase text-stone-900">¿Cómo la recibes?</legend>
        {offersSomething ? (
          <div className="mt-2 flex flex-col">
            {options.points.map((point) => (
              <label key={point.id} className="flex min-h-11 items-center gap-3 text-sm text-stone-800">
                <input type="radio" name={groupName} value={`point:${point.id}`} checked={choice === `point:${point.id}`} onChange={(event) => setChoice(event.target.value)} className="size-4 accent-pine" />
                <span>Punto fijo: <strong>{point.name}</strong> <span className="text-stone-600">· sin costo</span></span>
              </label>
            ))}
            {options.homeDelivery && (
              <label className="flex min-h-11 items-center gap-3 text-sm text-stone-800">
                <input type="radio" name={groupName} value="home" checked={choice === "home"} onChange={(event) => setChoice(event.target.value)} className="size-4 accent-pine" />
                <span>Envío a domicilio · <strong>{options.homeDelivery.feeLabel}</strong>{options.homeDelivery.note ? <span className="text-stone-600"> ({options.homeDelivery.note})</span> : null}</span>
              </label>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-700">Esta vendedora acuerda la entrega contigo por WhatsApp después de apartar.</p>
        )}
        {choice === "home" && (
          <div className="mt-2">
            <label htmlFor={`address-${sellerId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Dirección de entrega</label>
            <textarea id={`address-${sellerId}`} value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} rows={2} placeholder="Calle, número, colonia y municipio" className="mt-1 w-full border border-stone-300 bg-white p-2 text-sm" />
            <p className="text-xs text-stone-600">El envío se paga en la entrega, junto con el resto.</p>
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
