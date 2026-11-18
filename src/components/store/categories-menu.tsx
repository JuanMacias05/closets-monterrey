"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/features/products/types";

// Desktop drop-down. Products carry no Mujer/Hombre field, so the menu lists the categories
// the catalog can actually filter by rather than inventing sections that would come back empty.
export function CategoriesMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="categories-panel"
        onClick={() => setOpen((value) => !value)}
        className={`min-h-11 font-condensed font-bold uppercase ${open ? "underline decoration-pine decoration-2 underline-offset-8" : "hover:text-stone-600"}`}
      >
        Categorías
      </button>
      {open && (
        <div id="categories-panel" className="absolute inset-x-0 top-full z-50 border-b border-stone-200 bg-white px-12 py-10 shadow-[0_24px_40px_-24px_rgba(0,0,0,0.35)]">
          <ul className="grid max-w-3xl grid-cols-2 gap-x-16 gap-y-4 normal-case">
            <li><Link href="/" onClick={() => setOpen(false)} className="font-sans text-base font-normal tracking-normal hover:underline">Ver todo</Link></li>
            {PRODUCT_CATEGORIES.map((category) => (
              <li key={category.value}>
                <Link href={`/?category=${category.value}`} onClick={() => setOpen(false)} className="font-sans text-base font-normal tracking-normal hover:underline">{category.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
