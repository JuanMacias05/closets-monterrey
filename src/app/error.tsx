"use client";

import Link from "next/link";
import { useEffect } from "react";

// Friendly fallback for an unexpected failure (Supabase down, a query that throws). Next 16
// passes `retry`, which re-fetches the segment; the older `reset` would only re-render it with
// the same failed data.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="text-[10px] uppercase tracking-[0.24em] text-stone-500">BZRS Monterrey</p>
      <h1 className="mt-4 font-serif text-4xl tracking-tight text-stone-900 sm:text-5xl">Algo salió mal.</h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-stone-500">No pudimos cargar esta página. Inténtalo de nuevo en un momento.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="inline-flex min-h-12 items-center bg-pine px-7 font-condensed text-base font-bold uppercase text-white">Reintentar</button>
        <Link href="/" className="inline-flex min-h-12 items-center border border-stone-800 px-7 text-xs uppercase tracking-[0.18em] text-stone-800">Ir al catálogo</Link>
      </div>
    </main>
  );
}
