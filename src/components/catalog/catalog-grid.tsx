import Link from "next/link";
import { buildCatalogQueryString } from "@/features/products/catalog-filters";
import { CATALOG_PAGE_SIZE } from "@/features/products/catalog-data";
import type { CatalogFilters, CatalogPageResult } from "@/features/products/types";
import { ProductCard } from "@/components/catalog/product-card";

export function CatalogGrid({ result, filters, viewerId, favoriteIds, signedIn = false }: {
  result: CatalogPageResult; filters: CatalogFilters; viewerId?: string; favoriteIds?: Set<string>; signedIn?: boolean;
}) {
  if (result.error) {
    return (
      <div role="alert" className="border-y border-stone-200 py-16 text-center">
        <p className="font-serif text-2xl text-stone-800">El catálogo no está disponible por ahora.</p>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-stone-500">{result.error}</p>
      </div>
    );
  }

  // An empty store and an over-filtered search need different words: "no results for these
  // filters" on a store with no stock reads like a bug to the visitor.
  const hasFilters = Boolean(filters.audience || filters.category || filters.size || filters.condition
    || filters.minPrice !== undefined || filters.maxPrice !== undefined || filters.hideSold);

  if (result.products.length === 0 && !hasFilters) {
    return (
      <div className="border-y border-stone-200 py-20 text-center">
        <p className="font-serif text-2xl text-stone-800">Muy pronto, nuevas prendas.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-600">Nuestras vendedoras están preparando sus closets. Vuelve en unos días para ver lo nuevo.</p>
      </div>
    );
  }

  if (result.products.length === 0) {
    return (
      <div className="border-y border-stone-200 py-20 text-center">
        <p className="font-serif text-2xl text-stone-800">No encontramos prendas con estos filtros.</p>
        <p className="mt-3 text-sm text-stone-500">Prueba con otra talla, categoría o rango de precio.</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center border-b-2 border-pine font-condensed text-base font-bold uppercase text-pine">Ver todo el catálogo</Link>
      </div>
    );
  }

  const firstItem = (filters.page - 1) * CATALOG_PAGE_SIZE + 1;
  const lastItem = Math.min(filters.page * CATALOG_PAGE_SIZE, result.total);
  const nextQuery = buildCatalogQueryString(filters, filters.page + 1);

  return (
    <>
      <div className="flex items-center justify-between py-5 text-xs text-stone-500">
        <p>{firstItem}–{lastItem} de {result.total} prendas</p>
        <p className="hidden sm:block">Piezas únicas · Monterrey</p>
      </div>
      <div data-testid="product-grid" className="grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-4 lg:gap-x-6">
        {result.products.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} viewerId={viewerId} favorite={favoriteIds?.has(product.id) ?? false} signedIn={signedIn} />)}
      </div>
      {lastItem < result.total && (
        <div className="flex justify-center py-14">
          <Link href={`/?${nextQuery}`} rel="next" className="inline-flex min-h-12 items-center border-2 border-pine px-8 font-condensed text-base font-bold uppercase text-pine transition-colors hover:bg-pine hover:text-white">
            Cargar 24 prendas más
          </Link>
        </div>
      )}
    </>
  );
}
