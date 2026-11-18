import type { Metadata } from "next";
import Link from "next/link";
import { CatalogFiltersPanel } from "@/components/catalog/catalog-filters";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { StoreHeader } from "@/components/store/store-header";
import { CourierCard } from "@/components/couriers/courier-card";
import { getCourierDirectory } from "@/features/couriers/directory";
import { getShopState } from "@/features/shop/shop-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/features/viewer/get-viewer";
import { getCatalogPage } from "@/features/products/catalog-data";
import { parseCatalogFilters, type CatalogSearchParams } from "@/features/products/catalog-filters";
import { categoriesForSection } from "@/features/products/section-categories";

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
  const [result, viewer, shop, deliveryPoints, couriers] = await Promise.all([getCatalogPage(filters), getViewer(), getShopState(), getDeliveryPoints(), getCourierDirectory()]);
  const viewerId = viewer.kind === "guest" ? undefined : viewer.userId;

  return (
    <>
    <StoreHeader activeAudience={filters.audience} />
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-12 sm:px-8 lg:px-12">
      <section className="pb-8 pt-10 text-center sm:pb-10 sm:pt-14">
        <h1 className="font-heavy text-4xl leading-none tracking-tight text-stone-900 uppercase sm:text-6xl lg:text-8xl">Nuevo en tienda</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-stone-600">Prendas únicas, cuidadosamente elegidas por vendedoras de Monterrey.</p>
        <nav aria-label="Secciones" className="mt-7 flex justify-center gap-2 font-condensed text-base font-bold uppercase">
          <CategoryPill href="/" active={!filters.audience}>Todo</CategoryPill>
          <CategoryPill href="/?audience=women" active={filters.audience === "women"}>Mujer</CategoryPill>
          <CategoryPill href="/?audience=men" active={filters.audience === "men"}>Hombre</CategoryPill>
        </nav>
        <nav aria-label="Categorías" className="-mx-4 mt-4 flex gap-x-5 overflow-x-auto px-4 pb-1 text-sm sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
          <CategoryLink href={sectionHref(filters.audience)} active={!filters.category}>Ver todo</CategoryLink>
          {categoriesForSection(filters.audience).map((category) => (
            <CategoryLink key={category.value} href={sectionHref(filters.audience, category.value)} active={filters.category === category.value}>{category.label}</CategoryLink>
          ))}
        </nav>
      </section>

      <div className="xl:flex xl:items-start xl:gap-8">
        <div className="min-w-0 flex-1">
          <CatalogFiltersPanel filters={filters} deliveryPoints={deliveryPoints} />
          <CatalogGrid result={result} filters={filters} viewerId={viewerId} favoriteIds={shop.favoriteIds} signedIn={shop.signedIn} />
        </div>
        {couriers.length > 0 && (
          // Desktop only; phones get the floating button below instead.
          <aside aria-labelledby="couriers-aside" className="hidden w-72 shrink-0 xl:sticky xl:top-36 xl:block">
            <h2 id="couriers-aside" className="font-condensed text-lg font-bold uppercase text-stone-900">¿No puedes ir al punto?</h2>
            <p className="mt-1 text-sm text-stone-600">Pide una recolectora verificada al apartar.</p>
            <div className="mt-3 space-y-3">
              {couriers.slice(0, 3).map((courier) => <CourierCard key={courier.id} courier={courier} compact />)}
            </div>
            <Link href="/recolectoras" className="mt-3 inline-flex min-h-11 items-center font-condensed text-base font-bold uppercase text-pine underline underline-offset-4">Ver todas las recolectoras</Link>
          </aside>
        )}
      </div>
      {couriers.length > 0 && (
        <Link href="/recolectoras" className="fixed bottom-4 right-4 z-30 flex min-h-12 items-center gap-2 rounded-full bg-pine px-5 font-condensed text-base font-bold uppercase text-white shadow-lg xl:hidden">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" /></svg>
          Recolectoras
        </Link>
      )}

      <footer className="mt-10 border-t border-stone-200 py-6 text-[10px] uppercase tracking-[0.18em] text-stone-500">
        Monterrey, Nuevo León · Moda de segunda mano
      </footer>
    </main>
    </>
  );
}

// Category links keep the chosen section, so "Pantalones" inside Hombre stays in Hombre.
function sectionHref(audience?: string, category?: string) {
  const params = new URLSearchParams();
  if (audience) params.set("audience", audience);
  if (category) params.set("category", category);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function CategoryLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center whitespace-nowrap ${active ? "font-semibold text-stone-900 underline decoration-pine decoration-2 underline-offset-4" : "text-stone-600 hover:text-stone-900"}`}>
      {children}
    </Link>
  );
}

function CategoryPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center whitespace-nowrap border-2 border-pine px-4 ${active ? "bg-pine text-white" : "bg-white text-pine hover:bg-stone-50"}`}>
      {children}
    </Link>
  );
}

async function getDeliveryPoints() {
  if (process.env.CATALOG_DEMO_MODE === "true") return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("delivery_points").select("id,name").eq("active", true).order("sort_order");
  return data ?? [];
}
