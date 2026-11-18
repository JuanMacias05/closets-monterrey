"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOutFromPanel } from "@/app/panel/actions";
import { PRODUCT_CATEGORIES } from "@/features/products/types";

export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // The page behind the full-screen menu must not scroll under the finger.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button type="button" aria-label="Abrir menú" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)} className="grid size-11 place-items-center">
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>

      {open && (
        <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menú" className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-stone-200 px-2 py-1">
            <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="grid size-11 place-items-center">
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <span className="font-serif text-xl normal-case tracking-tight">Closets Monterrey</span>
            <span aria-hidden="true" className="size-11" />
          </div>

          <nav aria-label="Categorías" className="flex flex-1 flex-col overflow-y-auto px-5 py-2 font-sans text-base font-normal normal-case tracking-normal">
            <MenuLink href="/?sort=recent" onNavigate={() => setOpen(false)}>Nuevo</MenuLink>
            <MenuLink href="/" onNavigate={() => setOpen(false)}>Ver todo</MenuLink>
            {PRODUCT_CATEGORIES.map((category) => (
              <MenuLink key={category.value} href={`/?category=${category.value}`} onNavigate={() => setOpen(false)}>{category.label}</MenuLink>
            ))}
          </nav>

          <div className="border-t border-stone-200 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-condensed font-bold uppercase">
            {signedIn ? (
              <form action={signOutFromPanel}>
                <button type="submit" className="flex min-h-12 w-full items-center justify-center border-2 border-pine text-pine">Cerrar sesión</button>
              </form>
            ) : (
              <Link href="/login" className="flex min-h-12 items-center justify-center bg-pine text-white">Soy vendedora · Entrar</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, onNavigate, children }: { href: string; onNavigate: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onNavigate} className="flex min-h-13 items-center justify-between border-b border-stone-100">
      {children}
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}
