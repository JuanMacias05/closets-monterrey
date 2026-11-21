"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setFavorite } from "@/features/shop/actions";

// Heart toggle. Browsing is open to everyone; saving needs an account, so a signed-out tap
// goes to login and comes back to the same page.
export function FavoriteButton({ productId, productName, initial, signedIn, className = "" }: {
  productId: string; productName: string; initial: boolean; signedIn: boolean; className?: string;
}) {
  const router = useRouter();
  const [favorite, setFavoriteState] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Bumped on every save so the heart re-mounts and beats again; only saving beats, removing doesn't.
  const [beats, setBeats] = useState(0);

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const next = !favorite;
    setFavoriteState(next);
    if (next) setBeats((count) => count + 1);
    setBusy(true);
    const result = await setFavorite(productId, next);
    if (!result.ok) setFavoriteState(!next);
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorite}
      aria-label={favorite ? `Quitar ${productName} de favoritos` : `Agregar ${productName} a favoritos`}
      className={`press grid size-11 place-items-center text-stone-900 disabled:opacity-60 ${className}`}
    >
      <svg key={beats} aria-hidden="true" className={beats > 0 && favorite ? "heart-beat" : undefined} width="22" height="22" viewBox="0 0 24 24" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
      </svg>
    </button>
  );
}
