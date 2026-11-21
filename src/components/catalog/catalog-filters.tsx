"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CONDITIONS,
  PRODUCT_SIZES,
  type CatalogFilters,
} from "@/features/products/types";

function FilterFields({ filters, prefix, deliveryPoints }: { filters: CatalogFilters; prefix: string; deliveryPoints: DeliveryPointOption[] }) {
  return (
    <>
      {/* The section comes from the Mujer/Hombre navigation; carry it so applying filters doesn't drop it. */}
      {filters.audience && <input type="hidden" name="audience" value={filters.audience} />}
      {/* Filtering a search narrows its results; it doesn't start over from the whole catalog. */}
      {filters.q && <input type="hidden" name="q" value={filters.q} />}
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.15em] text-stone-500" htmlFor={`${prefix}-category`}>
        Categoría
        <select id={`${prefix}-category`} name="category" defaultValue={filters.category ?? ""} className="min-h-11 border-b border-stone-300 bg-transparent px-1 text-sm normal-case tracking-normal text-stone-800 outline-none focus:border-stone-900">
          <option value="">Todas</option>
          {PRODUCT_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.15em] text-stone-500" htmlFor={`${prefix}-delivery`}>
        ¿Dónde la recibes?
        <select id={`${prefix}-delivery`} name="entrega" defaultValue={filters.delivery ?? ""} className="min-h-11 border-b border-stone-300 bg-transparent px-1 text-sm normal-case tracking-normal text-stone-800 outline-none focus:border-stone-900">
          <option value="">Cualquier entrega</option>
          {deliveryPoints.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
          <option value="domicilio">Envío a domicilio</option>
        </select>
      </label>

      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.15em] text-stone-500" htmlFor={`${prefix}-size`}>
        Talla
        <select id={`${prefix}-size`} name="size" defaultValue={filters.size ?? ""} className="min-h-11 border-b border-stone-300 bg-transparent px-1 text-sm normal-case tracking-normal text-stone-800 outline-none focus:border-stone-900">
          <option value="">Todas</option>
          {PRODUCT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.15em] text-stone-500" htmlFor={`${prefix}-condition`}>
        Estado de la prenda
        <select id={`${prefix}-condition`} name="condition" defaultValue={filters.condition ?? ""} className="min-h-11 border-b border-stone-300 bg-transparent px-1 text-sm normal-case tracking-normal text-stone-800 outline-none focus:border-stone-900">
          <option value="">Todos</option>
          {PRODUCT_CONDITIONS.map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs uppercase tracking-[0.15em] text-stone-500">Precio (MXN)</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`${prefix}-min-price`}>Precio mínimo en pesos</label>
          <input id={`${prefix}-min-price`} name="minPrice" type="number" min="0" step="50" inputMode="numeric" placeholder="Mín." defaultValue={filters.minPrice ?? ""} className="min-h-11 w-full min-w-0 border-b border-stone-300 bg-transparent px-1 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-900" />
          <span aria-hidden="true" className="text-stone-400">—</span>
          <label className="sr-only" htmlFor={`${prefix}-max-price`}>Precio máximo en pesos</label>
          <input id={`${prefix}-max-price`} name="maxPrice" type="number" min="0" step="50" inputMode="numeric" placeholder="Máx." defaultValue={filters.maxPrice ?? ""} className="min-h-11 w-full min-w-0 border-b border-stone-300 bg-transparent px-1 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-900" />
        </div>
      </fieldset>

      <label className="flex items-center gap-3 text-sm text-stone-700">
        <input type="checkbox" name="hideSold" value="1" defaultChecked={filters.hideSold} className="size-4 accent-pine" />
        Ocultar prendas vendidas
      </label>

      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.15em] text-stone-500" htmlFor={`${prefix}-sort`}>
        Ordenar por
        <select id={`${prefix}-sort`} name="sort" defaultValue={filters.sort} className="min-h-11 border-b border-stone-300 bg-transparent px-1 text-sm normal-case tracking-normal text-stone-800 outline-none focus:border-stone-900">
          <option value="recent">Más recientes</option>
          <option value="price-asc">Precio: menor a mayor</option>
          <option value="price-desc">Precio: mayor a menor</option>
        </select>
      </label>
    </>
  );
}

export type DeliveryPointOption = { id: string; name: string };

// "Limpiar" drops the filters but keeps where you are: the section and the search.
function clearFiltersHref(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.audience) params.set("audience", filters.audience);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

// One "Filtros" button opens a side panel on every screen size. The old open filter bar on
// desktop pushed the first row of garments below the fold on a 1366×768 laptop. Changes
// apply as they happen (the URL is the source of truth, so a filtered catalog stays
// shareable); number fields wait a moment so typing "350" doesn't fire three navigations.
export function CatalogFiltersPanel({ filters, deliveryPoints = [] }: { filters: CatalogFilters; deliveryPoints?: DeliveryPointOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const };
  const activeCount = [filters.category, filters.delivery, filters.size, filters.condition, filters.minPrice, filters.maxPrice, filters.hideSold || undefined, filters.sort !== "recent" ? filters.sort : undefined]
    .filter((value) => value !== undefined && value !== null && value !== "").length;

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setIsOpen(false); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value !== "") params.set(key, value);
    }
    if (params.get("sort") === "recent") params.delete("sort");
    const query = params.toString();
    startTransition(() => router.replace(query ? `/?${query}` : "/", { scroll: false }));
  }

  function onChange(event: React.FormEvent<HTMLFormElement>) {
    window.clearTimeout(typingTimer.current);
    const target = event.target as HTMLInputElement;
    if (target.type === "number") typingTimer.current = window.setTimeout(apply, 500);
    else apply();
  }

  return (
    <>
      <button type="button" aria-expanded={isOpen} aria-controls="catalog-filters" onClick={() => setIsOpen(true)} className="press inline-flex min-h-11 shrink-0 items-center gap-2 border border-stone-300 px-4 text-xs uppercase tracking-[0.18em] text-stone-800 hover:border-stone-800">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Filtros{activeCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-pine px-1 text-[11px] tracking-normal text-white">{activeCount}</span>}
      </button>

      <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.button type="button" aria-label="Cerrar filtros" onClick={() => setIsOpen(false)} className="absolute inset-0 size-full bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} />
          <motion.section
            id="catalog-filters"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-filters-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-[#faf9f6] shadow-2xl"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={transition}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <h2 id="catalog-filters-title" className="font-serif text-2xl">Filtrar prendas</h2>
              <button type="button" autoFocus aria-label="Cerrar panel de filtros" onClick={() => setIsOpen(false)} className="grid size-11 place-items-center text-2xl text-stone-700">×</button>
            </div>
            <form ref={formRef} action="/" method="get" onChange={onChange} onSubmit={(event) => { event.preventDefault(); apply(); setIsOpen(false); }} className="grid flex-1 content-start gap-5 overflow-y-auto px-6 py-5">
              <FilterFields filters={filters} prefix="filters" deliveryPoints={deliveryPoints} />
            </form>
            <div className="flex gap-3 border-t border-stone-200 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <Link href={clearFiltersHref(filters)} onClick={() => setIsOpen(false)} className="press flex min-h-12 flex-1 items-center justify-center border border-stone-300 text-xs uppercase tracking-[0.16em] text-stone-700">Limpiar</Link>
              <button type="button" onClick={() => setIsOpen(false)} className="press min-h-12 flex-1 bg-pine font-condensed text-base font-bold uppercase text-white">
                {isPending ? "Actualizando…" : "Ver resultados"}
              </button>
            </div>
          </motion.section>
        </div>
      )}
      </AnimatePresence>
    </>
  );
}
