"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rateCourier } from "@/features/shop/actions";

export function RateCourier({ reservationId, courierName }: { reservationId: string; courierName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function rate(stars: number) {
    setBusy(true);
    setError(null);
    const result = await rateCourier(reservationId, stars);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }
  return (
    <div className="mt-3">
      <p className="text-sm text-stone-700">¿Cómo te fue con {courierName}?</p>
      <div className="mt-1 flex gap-1" role="group" aria-label={`Calificar a ${courierName}`}>
        {[1, 2, 3, 4, 5].map((stars) => (
          <button key={stars} type="button" disabled={busy} onClick={() => rate(stars)} aria-label={`${stars} de 5 estrellas`} className="grid size-11 place-items-center border border-stone-300 text-xl text-stone-800 hover:bg-stone-100 disabled:opacity-50">★</button>
        ))}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
