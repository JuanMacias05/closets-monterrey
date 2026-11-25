"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rateSeller } from "@/features/shop/actions";

// After a completed purchase: 1 to 5 stars for the store and an optional short comment, once.
// The comment goes to the store and the admins only; the stars count toward its public average.
export function RateSeller({ reservationId, storeName }: { reservationId: string; storeName: string }) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stars === 0) {
      setError("Elige de 1 a 5 estrellas.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await rateSeller(reservationId, stars, comment);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} aria-label={`Calificar a ${storeName}`} className="mt-3 space-y-2">
      <p className="text-sm text-stone-700">¿Cómo te fue con {storeName}?</p>
      <div role="group" aria-label={`Estrellas para ${storeName}`} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" aria-pressed={stars === value} aria-label={`${value} de 5 estrellas para la tienda`} onClick={() => setStars(value)}
            className={`grid size-11 place-items-center border text-xl ${value <= stars ? "border-pine bg-[#e6eee9] text-pine" : "border-stone-300 text-stone-400"} hover:bg-stone-100`}>★</button>
        ))}
      </div>
      <label htmlFor={`seller-comment-${reservationId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">Comentario (opcional, solo lo ve la tienda)</label>
      <textarea id={`seller-comment-${reservationId}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={280} rows={2} className="w-full border border-stone-300 bg-white p-2 text-sm sm:max-w-md" />
      <div><button type="submit" disabled={busy} className="min-h-11 bg-pine px-4 font-condensed text-sm font-bold uppercase text-white disabled:opacity-60">{busy ? "Guardando…" : "Enviar calificación"}</button></div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
