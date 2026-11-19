"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProductPrice } from "@/app/panel/prendas/actions";
import { formatPriceMXN } from "@/features/products/format-price";

// Inline price change from "Mis prendas", so a seller lowering a price doesn't have to open
// the full form. Only for available garments; see setProductPrice for why.
export function ProductPriceEditor({ productId, productName, priceInCents, editable }: {
  productId: string; productName: string; priceInCents: number; editable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState((priceInCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{formatPriceMXN(priceInCents)}</span>
        {editable && (
          <button type="button" onClick={() => setEditing(true)} aria-label={`Cambiar precio de ${productName}`} className="min-h-9 text-xs uppercase tracking-[0.12em] text-pine underline underline-offset-4">
            Cambiar
          </button>
        )}
      </span>
    );
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = value.trim().replace(",", ".");
    const cents = Math.round(Number(normalized) * 100);
    if (!normalized || !Number.isFinite(cents) || cents < 0) { setError("Escribe un precio válido."); return; }
    setBusy(true);
    setError(null);
    const result = await setProductPrice(productId, cents);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setEditing(false);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="inline-flex flex-wrap items-center gap-2">
      <label htmlFor={`price-${productId}`} className="sr-only">Nuevo precio de {productName} en pesos</label>
      <span aria-hidden="true">$</span>
      <input id={`price-${productId}`} type="number" inputMode="decimal" min="0" step="0.01" autoFocus value={value} onChange={(event) => setValue(event.target.value)} className="min-h-9 w-28 border-b border-stone-500 bg-transparent px-1 text-stone-900 outline-none focus:border-stone-900" />
      <button type="submit" disabled={busy} className="min-h-9 bg-pine px-3 font-condensed text-sm font-bold uppercase text-white disabled:opacity-50">{busy ? "Guardando…" : "Guardar"}</button>
      <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(null); setValue((priceInCents / 100).toFixed(2)); }} className="min-h-9 text-xs uppercase tracking-[0.12em] text-stone-600 underline underline-offset-4">Cancelar</button>
      {error && <span role="alert" className="w-full text-xs text-red-700">{error}</span>}
    </form>
  );
}
