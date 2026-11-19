import Link from "next/link";

// One footer for the storefront and the legal pages, so the privacy links are reachable from
// anywhere a visitor might land (Meta's reviewer included).
export function StoreFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-col gap-3 border-t border-stone-200 py-6 text-[10px] uppercase tracking-[0.18em] text-stone-500 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p>Monterrey, Nuevo León · Moda de segunda mano</p>
      <nav aria-label="Legal" className="flex gap-5">
        <Link href="/privacidad" className="inline-flex min-h-11 items-center hover:text-stone-800 sm:min-h-0">Aviso de privacidad</Link>
        <Link href="/borrar-datos" className="inline-flex min-h-11 items-center hover:text-stone-800 sm:min-h-0">Borrar mis datos</Link>
      </nav>
    </footer>
  );
}
