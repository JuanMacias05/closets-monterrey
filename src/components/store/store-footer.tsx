import Link from "next/link";

// One footer for the storefront and the legal pages, so the privacy notice is reachable from
// anywhere a visitor might land (Meta's reviewer included). "Borrar mis datos" left the footer by
// the owner's choice; the page stays (Meta's data-deletion URL, linked from the privacy notice
// and from the delete-account error).
export function StoreFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-col gap-3 border-t border-stone-200 py-6 text-[10px] uppercase tracking-[0.18em] text-stone-500 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p>BZRS Monterrey · Monterrey, Nuevo León</p>
      <nav aria-label="Legal" className="flex gap-5">
        {/* The verified couriers' page: out of the main nav (the panel has it), still one tap away here. */}
        <Link href="/recolectoras" className="inline-flex min-h-11 items-center hover:text-stone-800 sm:min-h-0">Recolección</Link>
        <Link href="/privacidad" className="inline-flex min-h-11 items-center hover:text-stone-800 sm:min-h-0">Aviso de privacidad</Link>
      </nav>
    </footer>
  );
}
