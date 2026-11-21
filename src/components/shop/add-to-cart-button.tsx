"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setInCart } from "@/features/shop/actions";

// Adding to the cart never holds the garment: five people can have the same piece in their
// carts. It is only held when someone presses "Apartar" in the cart.
export function AddToCartButton({ productId, initial, signedIn, available, isOwn }: {
  productId: string; initial: boolean; signedIn: boolean; available: boolean; isOwn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [inCart, setInCartState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOwn) return null;

  async function add() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await setInCart(productId, true);
    if (result.ok) {
      setInCartState(true);
      router.refresh();
    } else setError(result.error);
    setBusy(false);
  }

  const base = "flex min-h-14 w-full items-center justify-center px-6 font-condensed text-lg font-bold uppercase";

  return (
    <div className="mt-7">
      {inCart ? (
        <Link href="/carrito" className={`press ${base} border-2 border-pine text-pine`}>En tu carrito · Ver carrito</Link>
      ) : (
        <button type="button" onClick={add} disabled={!available || busy} data-testid="buy-button" className={`press ${base} bg-pine text-white hover:bg-pine-light disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600`}>
          {busy ? "Agregando…" : "Agregar al carrito"}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-center text-sm text-red-700">{error}</p>}
    </div>
  );
}
