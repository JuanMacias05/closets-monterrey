import Link from "next/link";
import { signOutFromPanel } from "@/app/panel/actions";
import { CategoriesMenu } from "@/components/store/categories-menu";
import { MobileMenu } from "@/components/store/mobile-menu";
import type { CatalogAudience } from "@/features/products/types";
import { getShopState } from "@/features/shop/shop-state";
import { getViewer, isSellerViewer } from "@/features/viewer/get-viewer";

// Storefront header shared by the catalog and product pages. A seller (or admin) sees the
// same header a guest does — they can browse and buy like anyone — plus a pine "Modo
// vendedora" bar above it holding the tools only their account has. Keeping the tools in
// their own bar, instead of mixing them into the account links, is what makes a seller
// account visibly different from a regular one.
export async function StoreHeader({ activeAudience }: { activeAudience?: CatalogAudience } = {}) {
  const [viewer, shop] = await Promise.all([getViewer(), getShopState()]);
  const signedIn = viewer.kind !== "guest";
  const cartLabel = `Carrito (${shop.cartIds.size})`;

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
          <Link href="/favoritos" className="hover:text-stone-600">Favoritos</Link>
          <Link href="/carrito" className="hover:text-stone-600">{cartLabel}</Link>
          {signedIn ? (
            <>
              <Link href={viewer.kind === "courier" ? "/recolectora" : "/cuenta"} className="hover:text-stone-600">{viewer.kind === "courier" ? "Mis entregas" : "Mi cuenta"}</Link>
              <form action={signOutFromPanel}>
                <button type="submit" className="min-h-11 font-condensed font-bold uppercase hover:text-stone-600">Cerrar sesión</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="hover:text-stone-600">Iniciar sesión</Link>
          )}
        </nav>
        {/* On phones the cart stays one tap away; the rest of the account links live in the menu. */}
        <Link href="/carrito" aria-label={cartLabel} className="relative grid size-11 place-items-center lg:hidden">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
          {shop.cartIds.size > 0 && <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-pine px-1 font-sans text-[11px] font-semibold text-white">{shop.cartIds.size}</span>}
        </Link>
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
        <Link href="/panel/apartados" className="flex min-h-9 items-center px-3 hover:underline">Apartados</Link>
        {isAdmin && <Link href="/panel/admin/vendedoras" className="flex min-h-9 items-center px-3 hover:underline">Vendedoras</Link>}
        {isAdmin && <Link href="/panel/admin/clientas" className="flex min-h-9 items-center px-3 hover:underline">Clientas</Link>}
        {isAdmin && <Link href="/panel/admin/recolectoras" className="flex min-h-9 items-center px-3 hover:underline">Recolectoras</Link>}
        {isAdmin && <Link href="/panel/admin/prendas" className="flex min-h-9 items-center px-3 hover:underline">Todas las prendas</Link>}
        <Link href="/panel" className="flex min-h-9 items-center px-3 hover:underline">Panel</Link>
      </nav>
    </div>
  );
}
