"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProductWithImages, setProductSaleStatus } from "@/app/panel/prendas/actions";
import type { ProductSaleStatus } from "@/features/products/types";

// Shown only on the viewer's own garments. The server actions re-check ownership
// (seller_id = auth.uid()) and RLS enforces it again, so hiding these buttons on other
// sellers' cards is UX, not the security boundary.
export function OwnerProductActions({ productId, productName, saleStatus }: { productId: string; productName: string; saleStatus: ProductSaleStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"status" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A reserved garment is mid-sale; only the panel should move it, so the toggle is offered
  // just between available and sold, matching setProductSaleStatus.
  const canToggleSold = saleStatus !== "reserved";

  async function toggleSold() {
    setBusy("status");
    setError(null);
    const result = await setProductSaleStatus(productId, saleStatus === "sold" ? "available" : "sold");
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(null);
  }

  async function remove() {
    if (!window.confirm(`¿Quitar "${productName}" de la tienda? Se borran la prenda y sus fotos.`)) return;
    setBusy("delete");
    setError(null);
    const result = await deleteProductWithImages(productId);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(null);
  }

  return (
    <div className="pt-2">
      <div className="flex gap-1.5 font-condensed text-sm font-bold uppercase">
        <Link href={`/panel/prendas/${productId}`} className="flex min-h-11 flex-1 items-center justify-center bg-pine text-white hover:bg-pine-light">Editar</Link>
        {canToggleSold && (
          <button type="button" onClick={toggleSold} disabled={busy !== null} className="min-h-11 flex-1 border-2 border-pine font-condensed font-bold uppercase text-pine disabled:opacity-40">
            {busy === "status" ? "…" : saleStatus === "sold" ? "Disponible" : "Vendida"}
          </button>
        )}
        <button type="button" onClick={remove} disabled={busy !== null} aria-label={`Quitar ${productName}`} className="min-h-11 flex-1 border-2 border-[#a3261b] font-condensed font-bold uppercase text-[#a3261b] disabled:opacity-40">
          {busy === "delete" ? "…" : "Quitar"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
