import Link from "next/link";
import { signOutFromPanel } from "@/app/panel/actions";
import { CategoriesMenu } from "@/components/store/categories-menu";
import { MobileMenu } from "@/components/store/mobile-menu";
import type { CatalogAudience } from "@/features/products/types";
import { getViewer, isSellerViewer } from "@/features/viewer/get-viewer";

// Storefront header shared by the catalog and product pages. A seller (or admin) sees the
// same header a guest does — they can browse and buy like anyone — plus a pine "Modo
// vendedora" bar above it holding the tools only their account has. Keeping the tools in
// their own bar, instead of mixing them into the account links, is what makes a seller
// account visibly different from a regular one.
export async function StoreHeader({ activeAudience }: { activeAudience?: CatalogAudience } = {}) {
  const viewer = await getViewer();
  const signedIn = viewer.kind !== "guest";

  return (
    <div className="sticky top-0 z-40 bg-white">
      {isSellerViewer(viewer) && <SellerBar storeName={viewer.storeName} isAdmin={viewer.kind === "admin"} />}

      <header className="relative flex items-center justify-between gap-4 border-b border-stone-200 px-2 py-1 font-condensed text-base font-bold uppercase tracking-[0.02em] text-stone-900 sm:px-6 sm:py-3 lg:text-lg">
        <div className="flex items-center gap-6">
          <MobileMenu signedIn={signedIn} initialAudience={activeAudience} />
          <nav aria-label="Categorías" className="hidden items-center gap-6 lg:flex">
            <CategoriesMenu activeAudience={activeAudience} />
            <Link href="/?sort=recent" className="hover:text-stone-600">Nuevo</Link>
          </nav>
        </div>

        <Link href="/" className="absolute left-1/2 -translate-x-1/2 font-serif text-xl normal-case tracking-tight text-stone-900 sm:text-2xl">Closets Monterrey</Link>

        <nav aria-label="Cuenta" className="hidden items-center gap-6 lg:flex">
          {signedIn ? (
            <form action={signOutFromPanel}>
              <button type="submit" className="min-h-11 font-condensed font-bold uppercase hover:text-stone-600">Cerrar sesión</button>
            </form>
          ) : (
            <Link href="/login" className="hover:text-stone-600">Soy vendedora</Link>
          )}
        </nav>
        {/* Keeps the logo centered on phones, where the account links live in the menu. */}
        <span aria-hidden="true" className="size-11 lg:hidden" />
      </header>

      <p className="bg-pine px-4 py-2 text-center font-condensed text-sm font-bold uppercase tracking-[0.04em] text-white sm:text-base">
        Moda circular · Prendas únicas de closets de Monterrey
      </p>
    </div>
  );
}

function SellerBar({ storeName, isAdmin }: { storeName: string; isAdmin: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-pine px-3 py-1.5 font-condensed text-sm font-bold uppercase tracking-[0.03em] text-white sm:px-6">
      <p className="flex min-w-0 items-center gap-2">
        <span className="bg-white px-2 py-0.5 text-xs text-pine">{isAdmin ? "Administración" : "Modo vendedora"}</span>
        <span className="truncate font-sans text-sm font-medium normal-case tracking-normal">{storeName}</span>
      </p>
      <nav aria-label="Herramientas de vendedora" className="flex flex-wrap items-center gap-1">
        <Link href="/panel/prendas/nueva" className="flex min-h-9 items-center gap-1.5 bg-white px-3 text-pine hover:bg-stone-100">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Agregar prenda
        </Link>
        <Link href="/panel/prendas" className="flex min-h-9 items-center px-3 hover:underline">Mis prendas</Link>
        {isAdmin && <Link href="/panel/admin/prendas" className="flex min-h-9 items-center px-3 hover:underline">Todas las prendas</Link>}
        <Link href="/panel" className="flex min-h-9 items-center px-3 hover:underline">Panel</Link>
      </nav>
    </div>
  );
}
