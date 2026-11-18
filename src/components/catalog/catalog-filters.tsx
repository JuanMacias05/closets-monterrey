"use client";

import { useState } from "react";
import Link from "next/link";
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

export function CatalogFiltersPanel({ filters, deliveryPoints = [] }: { filters: CatalogFilters; deliveryPoints?: DeliveryPointOption[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="hidden border-y border-stone-200 py-5 lg:block">
        <form action="/" method="get" className="grid grid-cols-4 items-end gap-x-6 gap-y-5 xl:grid-cols-8">
          <FilterFields filters={filters} prefix="desktop" deliveryPoints={deliveryPoints} />
          <div className="col-span-full flex items-center justify-end gap-5">
            <Link href="/" className="text-xs uppercase tracking-[0.16em] text-stone-500 underline-offset-4 hover:underline">Limpiar filtros</Link>
            <button type="submit" className="min-h-11 bg-pine px-6 font-condensed text-base font-bold uppercase text-white transition-colors hover:bg-pine-light">Aplicar filtros</button>
          </div>
        </form>
      </div>

      <div className="border-y border-stone-200 py-4 lg:hidden">
        <button type="button" aria-expanded={isOpen} aria-controls="mobile-catalog-filters" onClick={() => setIsOpen(true)} className="flex min-h-11 w-full items-center justify-between text-xs uppercase tracking-[0.18em] text-stone-800">
          <span>Filtros y orden</span>
          <span aria-hidden="true" className="text-lg">＋</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Cerrar filtros" onClick={() => setIsOpen(false)} className="absolute inset-0 size-full bg-black/35" />
          <section id="mobile-catalog-filters" role="dialog" aria-modal="true" aria-labelledby="mobile-filters-title" className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto bg-[#faf9f6] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-4">
              <h2 id="mobile-filters-title" className="font-serif text-2xl">Filtrar prendas</h2>
              <button type="button" aria-label="Cerrar panel de filtros" onClick={() => setIsOpen(false)} className="grid size-11 place-items-center text-2xl text-stone-700">×</button>
            </div>
            <form action="/" method="get" className="grid gap-5">
              <FilterFields filters={filters} prefix="mobile" deliveryPoints={deliveryPoints} />
              <div className="sticky bottom-0 flex gap-3 bg-[#faf9f6] py-3">
                <Link href="/" className="flex min-h-12 flex-1 items-center justify-center border border-stone-300 text-xs uppercase tracking-[0.16em] text-stone-700">Limpiar</Link>
                <button type="submit" className="min-h-12 flex-1 bg-pine font-condensed text-base font-bold uppercase text-white">Ver resultados</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
