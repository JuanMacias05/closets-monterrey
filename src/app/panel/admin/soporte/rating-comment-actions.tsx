"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRatingCommentHidden } from "@/app/panel/admin/soporte/actions";

// Hide (or show again) an abusive comment on a store rating. The stars stay.
export function RatingCommentToggle({ reservationId, hidden }: { reservationId: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle() {
    setBusy(true);
    setError(null);
    const result = await setRatingCommentHidden(reservationId, !hidden);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} onClick={toggle} className="min-h-10 border-2 border-stone-500 px-3 font-condensed text-sm font-bold uppercase text-stone-700 disabled:opacity-50">{hidden ? "Mostrar comentario" : "Ocultar comentario"}</button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
