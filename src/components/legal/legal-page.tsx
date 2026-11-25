import { BrandWordmark } from "@/components/brand/brand-wordmark";
import Link from "next/link";
import type { ReactNode } from "react";
import { StoreFooter } from "@/components/store/store-footer";
import { LEGAL_CONTACT, LEGAL_CONTACT_IS_PLACEHOLDER } from "@/features/legal/legal-contact";

// Shared shell for /privacidad and /borrar-datos: plain reading width, no store header (these
// pages are opened from Meta's review and from links in sign-up, not while shopping).
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <header className="border-b border-stone-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="text-xl text-stone-900"><BrandWordmark /></Link>
          <Link href="/" className="inline-flex min-h-11 items-center whitespace-nowrap text-xs uppercase tracking-[0.14em] text-stone-600 underline-offset-4 hover:underline">← Tienda</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        {LEGAL_CONTACT_IS_PLACEHOLDER && (
          <p role="note" className="mb-8 border border-amber-700 bg-amber-50 p-4 text-sm text-stone-800">
            Borrador: faltan el nombre y el correo de la persona responsable (src/features/legal/legal-contact.ts).
          </p>
        )}
        <h1 className="font-serif text-3xl tracking-tight text-stone-900 sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-stone-500">Última actualización: {LEGAL_CONTACT.lastUpdated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-7 text-stone-700">{children}</div>
      </main>
      <div className="mx-auto max-w-3xl px-4 sm:px-8"><StoreFooter /></div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-condensed text-xl font-bold uppercase text-stone-900">{title}</h2>
      {children}
    </section>
  );
}
