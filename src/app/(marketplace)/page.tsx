import type { Metadata } from "next";
import Link from "next/link";
import { CatalogFiltersPanel } from "@/components/catalog/catalog-filters";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { getCatalogPage } from "@/features/products/catalog-data";
import { parseCatalogFilters, type CatalogSearchParams } from "@/features/products/catalog-filters";

export const metadata: Metadata = {
  title: "Prendas | Closets Monterrey",
  description: "Descubre ropa de segunda mano seleccionada por vendedoras de Monterrey.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const filters = parseCatalogFilters(await searchParams);
  const result = await getCatalogPage(filters);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-12 sm:px-8 lg:px-12">
      <header className="flex items-center justify-between border-b border-stone-200 py-5 sm:py-7">
        <Link href="/" className="font-serif text-xl tracking-tight text-stone-900 sm:text-2xl">Closets Monterrey</Link>
        <p className="hidden text-[10px] uppercase tracking-[0.24em] text-stone-500 sm:block">Moda circular · Nuevo León</p>
        <Link href="/?sort=recent" className="text-[10px] uppercase tracking-[0.18em] text-stone-600 sm:text-xs">Ver novedades</Link>
      </header>

      <section className="pb-8 pt-10 sm:pb-10 sm:pt-16">
        <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500 sm:text-xs">Selección de closets locales</p>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h1 className="max-w-3xl font-serif text-4xl leading-[1.08] tracking-tight text-stone-900 sm:text-6xl lg:text-7xl">Piezas que merecen otra historia.</h1>
          <p className="max-w-xs text-sm leading-6 text-stone-500 sm:text-right">Prendas únicas, cuidadosamente elegidas por vendedoras de Monterrey.</p>
        </div>
      </section>

      <CatalogFiltersPanel filters={filters} />
      <CatalogGrid result={result} filters={filters} />

      <footer className="mt-10 border-t border-stone-200 py-6 text-[10px] uppercase tracking-[0.18em] text-stone-500">
        Monterrey, Nuevo León · Moda de segunda mano
      </footer>
    </main>
  );
}
