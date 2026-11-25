import Link from "next/link";

// Site-wide 404. Garment pages keep their own ("Esta pieza ya no está aquí").
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="text-[10px] uppercase tracking-[0.24em] text-stone-500">BZRS Monterrey · 404</p>
      <h1 className="mt-4 font-serif text-4xl tracking-tight text-stone-900 sm:text-5xl">Esta página no existe.</h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-stone-500">Puede que el enlace esté mal escrito o que la página ya no esté.</p>
      <Link href="/" className="mt-8 inline-flex min-h-12 items-center border border-stone-800 px-7 text-xs uppercase tracking-[0.18em] text-stone-800 transition-colors hover:bg-stone-900 hover:text-white">Ir al catálogo</Link>
    </main>
  );
}
