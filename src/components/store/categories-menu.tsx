"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { categoriesForSection } from "@/features/products/section-categories";
import type { CatalogAudience } from "@/features/products/types";

const SECTIONS: { audience: CatalogAudience; label: string }[] = [
  { audience: "women", label: "Mujer" },
  { audience: "men", label: "Hombre" },
];

// Desktop navigation. "Mujer" and "Hombre" are links straight to the whole section; hovering
// (or focusing) one opens a panel with that section's categories. They used to be buttons that
// only opened the panel, so reaching a section took a second click on "Ver todo".
// One component owns both so only one panel can be open at a time.
export function CategoriesMenu({ activeAudience }: { activeAudience?: CatalogAudience }) {
  const [open, setOpen] = useState<CatalogAudience | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The panel hangs a few pixels below the links, so the pointer crosses empty header space on
  // its way down. Closing on the first mouseleave shut the panel before you could reach it; a
  // short grace period lets the pointer land on the panel, whose mouseenter cancels the close.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function closeSoon() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(null), 200);
  }

  useEffect(() => cancelClose, []);

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
    <div ref={rootRef} className="flex items-center gap-6" onMouseEnter={cancelClose} onMouseLeave={closeSoon}>
      {SECTIONS.map((section) => {
        const highlighted = open === section.audience || (open === null && activeAudience === section.audience);
        return (
          <Link
            key={section.audience}
            href={`/?audience=${section.audience}`}
            aria-current={activeAudience === section.audience ? "page" : undefined}
            onMouseEnter={() => { cancelClose(); setOpen(section.audience); }}
            onFocus={() => setOpen(section.audience)}
            onClick={() => setOpen(null)}
            className={`flex min-h-11 items-center font-condensed font-bold uppercase ${highlighted ? "underline decoration-pine decoration-2 underline-offset-8" : "hover:text-stone-600"}`}
          >
            <span className={highlighted ? undefined : "link-underline"}>{section.label}</span>
          </Link>
        );
      })}
      {openSection && (
        <div id="categories-panel" className="panel-fade-in absolute inset-x-0 top-full z-50 border-b border-stone-200 bg-white px-12 py-10 shadow-[0_24px_40px_-24px_rgba(0,0,0,0.35)]">
          <p className="mb-5 font-condensed text-sm font-bold uppercase tracking-[0.06em] text-stone-500">{openSection.label}</p>
          <ul className="grid max-w-3xl grid-cols-2 gap-x-16 gap-y-4 normal-case">
            <li><Link href={`/?audience=${openSection.audience}`} onClick={() => setOpen(null)} className="link-underline font-sans text-base font-normal tracking-normal">Todo {openSection.label}</Link></li>
            {categoriesForSection(openSection.audience).map((category) => (
              <li key={category.value}>
                <Link href={`/?audience=${openSection.audience}&category=${category.value}`} onClick={() => setOpen(null)} className="link-underline font-sans text-base font-normal tracking-normal">{category.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
