"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { categoriesForSection } from "@/features/products/section-categories";
import type { CatalogAudience } from "@/features/products/types";

const SECTIONS: { audience: CatalogAudience; label: string }[] = [
  { audience: "women", label: "Mujer" },
  { audience: "men", label: "Hombre" },
];

// Desktop navigation: a "Mujer" and a "Hombre" trigger, each opening a panel with that
// section's categories. One component owns both so only one panel can be open at a time.
export function CategoriesMenu({ activeAudience }: { activeAudience?: CatalogAudience }) {
  const [open, setOpen] = useState<CatalogAudience | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openSection = SECTIONS.find((section) => section.audience === open);

  return (
    <div ref={rootRef} className="flex items-center gap-6">
      {SECTIONS.map((section) => {
        const highlighted = open === section.audience || (open === null && activeAudience === section.audience);
        return (
          <button
            key={section.audience}
            type="button"
            aria-expanded={open === section.audience}
            aria-controls="categories-panel"
            onClick={() => setOpen((value) => (value === section.audience ? null : section.audience))}
            className={`min-h-11 font-condensed font-bold uppercase ${highlighted ? "underline decoration-pine decoration-2 underline-offset-8" : "hover:text-stone-600"}`}
          >
            {section.label}
          </button>
        );
      })}
      {openSection && (
        <div id="categories-panel" className="absolute inset-x-0 top-full z-50 border-b border-stone-200 bg-white px-12 py-10 shadow-[0_24px_40px_-24px_rgba(0,0,0,0.35)]">
          <p className="mb-5 font-condensed text-sm font-bold uppercase tracking-[0.06em] text-stone-500">{openSection.label}</p>
          <ul className="grid max-w-3xl grid-cols-2 gap-x-16 gap-y-4 normal-case">
            <li><Link href={`/?audience=${openSection.audience}`} onClick={() => setOpen(null)} className="font-sans text-base font-normal tracking-normal hover:underline">Ver todo</Link></li>
            {categoriesForSection(openSection.audience).map((category) => (
              <li key={category.value}>
                <Link href={`/?audience=${openSection.audience}&category=${category.value}`} onClick={() => setOpen(null)} className="font-sans text-base font-normal tracking-normal hover:underline">{category.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
