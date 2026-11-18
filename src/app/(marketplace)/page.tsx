import type { Metadata } from "next";
import Link from "next/link";
import { CatalogFiltersPanel } from "@/components/catalog/catalog-filters";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { StoreHeader } from "@/components/store/store-header";
import { getViewer } from "@/features/viewer/get-viewer";
import { getCatalogPage } from "@/features/products/catalog-data";
import { parseCatalogFilters, type CatalogSearchParams } from "@/features/products/catalog-filters";
import { PRODUCT_CATEGORIES } from "@/features/products/types";

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
  const [result, viewer] = await Promise.all([getCatalogPage(filters), getViewer()]);
  const viewerId = viewer.kind === "guest" ? undefined : viewer.userId;

  return (
    <>
    <StoreHeader />
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-12 sm:px-8 lg:px-12">
      <section className="pb-8 pt-10 text-center sm:pb-10 sm:pt-14">
        <h1 className="font-heavy text-4xl leading-none tracking-tight text-stone-900 uppercase sm:text-6xl lg:text-8xl">Nuevo en tienda</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-stone-600">Prendas únicas, cuidadosamente elegidas por vendedoras de Monterrey.</p>
        <nav aria-label="Categorías rápidas" className="-mx-4 mt-7 flex gap-2 overflow-x-auto px-4 pb-1 font-condensed text-sm font-bold uppercase sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:text-base">
          <CategoryPill href="/" active={!filters.category}>Todo</CategoryPill>
          {PRODUCT_CATEGORIES.map((category) => (
            <CategoryPill key={category.value} href={`/?category=${category.value}`} active={filters.category === category.value}>{category.label}</CategoryPill>
          ))}
        </nav>
      </section>

      <CatalogFiltersPanel filters={filters} />
      <CatalogGrid result={result} filters={filters} viewerId={viewerId} />

      <footer className="mt-10 border-t border-stone-200 py-6 text-[10px] uppercase tracking-[0.18em] text-stone-500">
        Monterrey, Nuevo León · Moda de segunda mano
      </footer>
    </main>
    </>
  );
}

function CategoryPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center whitespace-nowrap border-2 border-pine px-4 ${active ? "bg-pine text-white" : "bg-white text-pine hover:bg-stone-50"}`}>
      {children}
    </Link>
  );
}
