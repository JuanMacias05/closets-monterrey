"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInCart } from "@/features/shop/actions";

export function RemoveFromCartButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    const result = await setInCart(productId, false);
    if (result.ok) router.refresh();
    setBusy(false);
  }
  return (
    <button type="button" onClick={remove} disabled={busy} aria-label={`Quitar ${productName} del carrito`} className="min-h-11 text-sm text-stone-600 underline underline-offset-4 disabled:opacity-50">
      {busy ? "Quitando…" : "Quitar"}
    </button>
  );
}
