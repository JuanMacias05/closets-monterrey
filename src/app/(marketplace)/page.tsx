import type { Metadata } from "next";
import Link from "next/link";
import { CatalogFiltersPanel } from "@/components/catalog/catalog-filters";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { CourierCard } from "@/components/couriers/courier-card";
import { getCourierDirectory } from "@/features/couriers/directory";
import { getShopState } from "@/features/shop/shop-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/features/viewer/get-viewer";
import { countNewArrivals, getCatalogPage, NEW_ARRIVALS_MINIMUM, newArrivalsSince } from "@/features/products/catalog-data";
import { parseCatalogFilters, type CatalogSearchParams } from "@/features/products/catalog-filters";
import { categoryLabel } from "@/features/products/section-categories";

export const metadata: Metadata = {
  title: "Prendas | BZRS Monterrey",
  description: "Compra y vende ropa de segunda mano en Monterrey.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const parsed = parseCatalogFilters(await searchParams);
  // The plain home page (no section, filter or ?ver=todo) shows only what's new, unless too
  // little is new; see NEW_ARRIVALS_* in catalog-data.
  const isPlainHome = !parsed.q && !parsed.showAll && !parsed.audience && !parsed.category && !parsed.size && !parsed.condition
    && !parsed.delivery && parsed.minPrice === undefined && parsed.maxPrice === undefined && !parsed.hideSold && parsed.sort === "recent";
  const newSince = newArrivalsSince();
  const showingNewOnly = isPlainHome && (await countNewArrivals(newSince)) >= NEW_ARRIVALS_MINIMUM;
  const filters = showingNewOnly ? { ...parsed, newSince } : parsed;
  const [result, viewer, shop, deliveryPoints, couriers] = await Promise.all([getCatalogPage(filters), getViewer(), getShopState(), getDeliveryPoints(), getCourierDirectory()]);
  const heading = filters.q ? `“${filters.q}”` : filters.audience === "women" ? "Mujer" : filters.audience === "men" ? "Hombre" : filters.showAll ? "Todo el catálogo" : showingNewOnly ? "Nuevo en tienda" : "Prendas en tienda";
  const viewerId = viewer.kind === "guest" ? undefined : viewer.userId;

  return (
    <>
    <StoreHeader activeAudience={filters.audience} />
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-12 sm:px-8 lg:px-12">
      {/* Kept short on purpose: on a 1366×768 laptop the first row of garments has to show
          without scrolling. Sections and their categories live in the top menu (Mujer/Hombre);
          repeating them here as a second row only pushed the garments down. */}
      <section className="flex items-end justify-between gap-4 border-b border-stone-200 pb-3 pt-6 sm:pt-8">
        <div className="min-w-0">
          {filters.q && <p className="font-condensed text-sm font-bold uppercase tracking-[0.06em] text-stone-500">Resultados de búsqueda</p>}
          <h1 className="font-serif text-2xl tracking-tight text-stone-900 sm:text-3xl">
            {heading}{filters.category && <span className="text-stone-500"> · {categoryLabel(filters.category, filters.audience)}</span>}
          </h1>
          {filters.q && (
            <p className="mt-1 text-sm text-stone-600">
              <Link href={filters.audience ? `/?audience=${filters.audience}` : "/?ver=todo"} className="text-pine underline underline-offset-4">Quitar búsqueda</Link>
            </p>
          )}
          {showingNewOnly && (
            <p className="mt-1 text-sm text-stone-600">
              Lo que llegó en las últimas 2 semanas. <Link href="/?ver=todo" className="text-pine underline underline-offset-4">Ver todo el catálogo</Link>
            </p>
          )}
        </div>
        <CatalogFiltersPanel filters={filters} deliveryPoints={deliveryPoints} />
      </section>

      <div className="xl:flex xl:items-start xl:gap-8">
        <div className="min-w-0 flex-1">
          <CatalogGrid result={result} filters={filters} viewerId={viewerId} favoriteIds={shop.favoriteIds} signedIn={shop.signedIn} />
        </div>
        {couriers.length > 0 && (
          // Desktop only; phones get the floating button below instead.
          <aside aria-labelledby="couriers-aside" className="hidden w-72 shrink-0 xl:sticky xl:top-36 xl:block">
            <h2 id="couriers-aside" className="font-condensed text-lg font-bold uppercase text-stone-900">¿No puedes ir al punto?</h2>
            <p className="mt-1 text-sm text-stone-600">Pide recolección verificada al apartar.</p>
            <div className="mt-3 space-y-3">
              {couriers.slice(0, 3).map((courier) => <CourierCard key={courier.id} courier={courier} compact />)}
            </div>
            <Link href="/recolectoras" className="mt-3 inline-flex min-h-11 items-center font-condensed text-base font-bold uppercase text-pine underline underline-offset-4">Ver quién recolecta</Link>
          </aside>
        )}
      </div>
      {couriers.length > 0 && (
        <Link href="/recolectoras" className="fixed bottom-4 right-4 z-30 flex min-h-12 items-center gap-2 rounded-full bg-pine px-5 font-condensed text-base font-bold uppercase text-white shadow-lg xl:hidden">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" /></svg>
          Recolección
        </Link>
      )}

      <StoreFooter className="mt-10" />
    </main>
    </>
  );
}



async function getDeliveryPoints() {
  if (process.env.CATALOG_DEMO_MODE === "true") return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("delivery_points").select("id,name").eq("active", true).order("sort_order");
  return data ?? [];
}
