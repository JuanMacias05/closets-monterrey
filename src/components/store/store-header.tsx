import Link from "next/link";
import { signOutFromPanel } from "@/app/panel/actions";
import { CategoriesMenu } from "@/components/store/categories-menu";
import { CartCount } from "@/components/store/cart-count";
import { MobileMenu } from "@/components/store/mobile-menu";
import { StoreSearchPanel, StoreSearchProvider, StoreSearchTrigger } from "@/components/store/store-search";
import type { CatalogAudience } from "@/features/products/types";
import { unreadCount } from "@/features/chat/chat-data";
import { getShopState } from "@/features/shop/shop-state";
import { getViewer, isSellerViewer } from "@/features/viewer/get-viewer";

// Storefront header shared by the catalog and product pages. A seller (or admin) sees the
// same header a guest does — they can browse and buy like anyone — plus a pine "Modo
// vendedora" bar above it holding the tools only their account has. Keeping the tools in
// their own bar, instead of mixing them into the account links, is what makes a seller
// account visibly different from a regular one.
export async function StoreHeader({ activeAudience }: { activeAudience?: CatalogAudience } = {}) {
  const [viewer, shop] = await Promise.all([getViewer(), getShopState()]);
  // Unread chat messages ride on the account link: buyers' chats live in /cuenta, couriers' in
  // /recolectora (sellers see theirs in the panel menu).
  const unread = viewer.kind === "buyer" || viewer.kind === "seller" || viewer.kind === "admin"
    ? await unreadCount("buyer")
    : viewer.kind === "courier" ? await unreadCount("courier") : 0;
  const accountLabel = viewer.kind === "courier" ? "Mis entregas" : "Mi cuenta";
  const signedIn = viewer.kind !== "guest";
  const cartCount = shop.cartIds.size;
  const cartLabel = `Carrito (${cartCount})`;

  return (
    <StoreSearchProvider>
    <div className="sticky top-0 z-40 bg-white">
      {isSellerViewer(viewer) && <SellerBar storeName={viewer.storeName} isAdmin={viewer.kind === "admin"} />}

      {/* bg-white: the search panel's backdrop sits under the header, and must not show through it. */}
      <header className="relative flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-2 py-1 font-condensed text-base font-bold uppercase tracking-[0.02em] text-stone-900 sm:px-6 sm:py-3 lg:text-lg">
        <div className="flex items-center gap-6">
          <MobileMenu signedIn={signedIn} accountHref={viewer.kind === "courier" ? "/recolectora" : "/cuenta"} accountLabel={unread > 0 ? `${accountLabel} (${unread})` : accountLabel} initialAudience={activeAudience} />
          <nav aria-label="Categorías" className="hidden items-center gap-6 lg:flex">
            <CategoriesMenu activeAudience={activeAudience} />
            <Link href="/" className="link-underline hover:text-stone-600">Nuevo</Link>
            <StoreSearchTrigger variant="desktop" />
          </nav>
          <Link href="/recolectoras" className="link-underline hidden hover:text-stone-600 lg:inline">Recolectoras</Link>
        </div>

        {/* Smaller under 400px: the phone header also holds search and cart on the right. */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-lg normal-case tracking-tight text-stone-900 min-[400px]:text-xl sm:text-2xl">Closets Monterrey</Link>

        <nav aria-label="Cuenta" className="hidden items-center gap-6 lg:flex">
          <Link href="/favoritos" className="link-underline hover:text-stone-600">Favoritos</Link>
          <Link href="/carrito" aria-label={cartLabel} className="link-underline hover:text-stone-600">Carrito (<CartCount count={cartCount} />)</Link>
          {signedIn ? (
            <>
              <Link href={viewer.kind === "courier" ? "/recolectora" : "/cuenta"} className="link-underline hover:text-stone-600">
                {accountLabel}
                {unread > 0 && <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-[#a3261b] px-1 align-middle font-sans text-[11px] font-semibold text-white"><span aria-hidden="true">{unread}</span><span className="sr-only"> ({unread === 1 ? "1 mensaje sin leer" : `${unread} mensajes sin leer`})</span></span>}
              </Link>
              <form action={signOutFromPanel}>
                <button type="submit" className="press min-h-11 font-condensed font-bold uppercase hover:text-stone-600">Cerrar sesión</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="link-underline hover:text-stone-600">Iniciar sesión</Link>
          )}
        </nav>
        {/* On phones search and the cart stay one tap away; the rest of the account links live in the menu. */}
        <div className="flex items-center lg:hidden">
          <StoreSearchTrigger variant="mobile" />
          <Link href="/carrito" aria-label={cartLabel} className="press relative grid size-11 place-items-center">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
            {/* Kept mounted at zero so the badge can bump when the first item goes in. */}
            <span aria-hidden="true" className={`absolute right-0.5 top-0.5 ${cartCount > 0 ? "" : "hidden"}`}><CartCount count={cartCount} className="grid min-w-5 place-items-center rounded-full bg-pine px-1 font-sans text-[11px] font-semibold text-white" /></span>
          </Link>
        </div>

        <StoreSearchPanel />
      </header>

      <p className="bg-pine px-4 py-2 text-center font-condensed text-sm font-bold uppercase tracking-[0.04em] text-white sm:text-base">
        Moda circular · Prendas únicas de clósets de Monterrey
      </p>
    </div>
    </StoreSearchProvider>
  );
}

// Only the two actions a seller reaches for while browsing her own catalog. Everything else
// (her list, reservations, the admin pages) lives in the panel, so the bar stays one line.
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
        <Link href="/panel" className="flex min-h-9 items-center px-3 hover:underline">Panel</Link>
      </nav>
    </div>
  );
}
