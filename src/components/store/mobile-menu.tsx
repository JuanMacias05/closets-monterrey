"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { signOutFromPanel } from "@/app/panel/actions";
import { useStoreSearch } from "@/components/store/store-search";
import { categoriesForSection } from "@/features/products/section-categories";
import type { CatalogAudience } from "@/features/products/types";

export function MobileMenu({ signedIn, accountHref = "/cuenta", accountLabel = "Mi cuenta", initialAudience }: {
  signedIn: boolean; accountHref?: string; accountLabel?: string; initialAudience?: CatalogAudience;
}) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<CatalogAudience>(initialAudience ?? "women");
  const search = useStoreSearch();
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

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
      <button type="button" aria-label="Abrir menú" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)} className="press grid size-11 place-items-center">
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className="fixed inset-0 z-50 flex flex-col bg-white"
          initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
          animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
          transition={transition}
        >
          <div className="flex items-center justify-between border-b border-stone-200 px-2 py-1">
            <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="grid size-11 place-items-center">
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <span className="font-serif text-xl normal-case tracking-tight">Closets Monterrey</span>
            <span aria-hidden="true" className="size-11" />
          </div>

          <div className="flex border-b border-stone-200 font-condensed text-lg font-bold uppercase">
            {(["women", "men"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={audience === value} onClick={() => setAudience(value)} className={`min-h-13 flex-1 border-b-[3px] ${audience === value ? "border-pine text-stone-900" : "border-transparent text-stone-500"}`}>
                {value === "women" ? "Mujer" : "Hombre"}
              </button>
            ))}
          </div>

          {search && (
            <div className="border-b border-stone-200 px-5 py-3">
              <button type="button" onClick={() => { setOpen(false); search.open(); }} className="press flex min-h-12 w-full items-center gap-3 border border-stone-300 px-4 font-sans text-base font-normal normal-case tracking-normal text-stone-500">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
                <span>Buscar prendas</span>
              </button>
            </div>
          )}

          <nav aria-label={audience === "women" ? "Categorías de Mujer" : "Categorías de Hombre"} className="flex flex-1 flex-col overflow-y-auto px-5 py-2 font-sans text-base font-normal normal-case tracking-normal">
            <MenuLink href="/" onNavigate={() => setOpen(false)}>Nuevo</MenuLink>
            <MenuLink href={`/?audience=${audience}`} onNavigate={() => setOpen(false)}>Todo {audience === "women" ? "Mujer" : "Hombre"}</MenuLink>
            {categoriesForSection(audience).map((category) => (
              <MenuLink key={category.value} href={`/?audience=${audience}&category=${category.value}`} onNavigate={() => setOpen(false)}>{category.label}</MenuLink>
            ))}
          </nav>

          <div className="border-t border-stone-200 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-condensed font-bold uppercase">
            <Link href="/recolectoras" onClick={() => setOpen(false)} className="mb-2 flex min-h-11 items-center justify-between border-b border-stone-100">
              Recolectoras verificadas
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
            <div className="mb-3 flex justify-between">
              <Link href="/favoritos" onClick={() => setOpen(false)} className="flex min-h-11 items-center">Favoritos</Link>
              <Link href="/carrito" onClick={() => setOpen(false)} className="flex min-h-11 items-center">Carrito</Link>
              {signedIn && <Link href={accountHref} onClick={() => setOpen(false)} className="flex min-h-11 items-center">{accountLabel}</Link>}
            </div>
            {signedIn ? (
              <form action={signOutFromPanel}>
                <button type="submit" className="press flex min-h-12 w-full items-center justify-center border-2 border-pine text-pine">Cerrar sesión</button>
              </form>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="press flex min-h-12 flex-1 items-center justify-center bg-pine text-white">Iniciar sesión</Link>
                <Link href="/registro" className="press flex min-h-12 flex-1 items-center justify-center border-2 border-pine text-pine">Crear cuenta</Link>
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
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
