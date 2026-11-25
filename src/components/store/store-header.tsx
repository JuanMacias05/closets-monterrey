import { BrandWordmark } from "@/components/brand/brand-wordmark";
import Link from "next/link";
import { AccountMenu } from "@/components/store/account-menu";
import { CategoriesMenu } from "@/components/store/categories-menu";
import { CartCount } from "@/components/store/cart-count";
import { MobileMenu } from "@/components/store/mobile-menu";
import { PanelMenuBar } from "@/components/store/panel-menu-bar";
import { StoreSearchPanel, StoreSearchProvider, StoreSearchTrigger } from "@/components/store/store-search";
import { unreadTotal } from "@/features/chat/chat-data";
import { accountMenu, BUYER_ONLY, canUploadGarments, hasPanel, panelMenuGroups, panelTag, type ActivityFlags } from "@/features/panel/panel-navigation";
import type { CatalogAudience } from "@/features/products/types";
import { getShopState } from "@/features/shop/shop-state";
import { stopViewingAsBuyer } from "@/features/viewer/view-as-actions";
import { getViewAsBuyer, getViewer } from "@/features/viewer/get-viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The store header, the same on every page for every account (accounts and menu proposal,
// approved 2026-11-21): the panel never changes the store's look. On top of it:
//   * a green bar with "PANEL ▾" for accounts that sell, deliver or administer (one column per
//     activity); a buyer-only account has no green bar at all;
//   * "MI CUENTA ▾" in the white nav for every signed-in account.
// "Ver como cliente" draws it as a buyer-only account sees it, with an amber strip to go back.
export async function StoreHeader({ activeAudience }: { activeAudience?: CatalogAudience } = {}) {
  const [viewer, shop, viewAsBuyer] = await Promise.all([getViewer(), getShopState(), getViewAsBuyer()]);
  const signedIn = viewer.kind !== "guest";
  const real: ActivityFlags = viewer.kind === "account"
    ? { seller: viewer.seller?.status ?? null, courier: viewer.courier?.status ?? null, admin: viewer.admin }
    : BUYER_ONLY;
  const flags = viewAsBuyer ? BUYER_ONLY : real;
  const unread = signedIn ? await unreadTotal() : 0;
  const pendingRequests = flags.courier === "approved" && viewer.kind === "account" ? await waitingCourierRequests(viewer.userId) : 0;
  const groups = panelMenuGroups(flags, pendingRequests);
  const account = accountMenu(flags, unread);
  const cartCount = shop.cartIds.size;
  const cartLabel = `Carrito (${cartCount})`;

  return (
    <StoreSearchProvider>
    <div className="sticky top-0 z-40 bg-white">
      {viewAsBuyer && (
        <form action={stopViewingAsBuyer} className="flex flex-wrap items-center justify-center gap-x-3 bg-amber-300 px-3 py-1.5 text-center text-sm text-stone-900">
          <span>Estás viendo la tienda como cliente.</span>
          <button type="submit" className="min-h-9 font-semibold underline underline-offset-4">Volver a admin</button>
        </form>
      )}
      {viewer.kind === "account" && hasPanel(flags) && (
        <PanelMenuBar tag={panelTag(flags)} name={viewer.seller?.storeName ?? viewer.name} groups={groups} canUpload={canUploadGarments(flags)} />
      )}

      {/* bg-white: the search panel's backdrop sits under the header, and must not show through it. */}
      <header className="relative flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-2 py-1 font-condensed text-base font-bold uppercase tracking-[0.02em] text-stone-900 sm:px-6 sm:py-3 lg:text-lg">
        <div className="flex items-center gap-6">
          <MobileMenu signedIn={signedIn} accountItems={account.items} accountExtra={account.extra} initialAudience={activeAudience} />
          <nav aria-label="Categorías" className="hidden items-center gap-6 lg:flex">
            <CategoriesMenu activeAudience={activeAudience} />
            <Link href="/" className="link-underline hover:text-stone-600">Nuevo</Link>
            <StoreSearchTrigger variant="desktop" />
          </nav>
        </div>

        {/* Smaller under 400px: the phone header also holds search and cart on the right. */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-lg normal-case tracking-tight text-stone-900 min-[400px]:text-xl sm:text-2xl"><BrandWordmark /></Link>

        <nav aria-label="Cuenta" className="hidden items-center gap-6 lg:flex">
          <Link href="/favoritos" className="link-underline hover:text-stone-600">Favoritos</Link>
          <Link href="/carrito" aria-label={cartLabel} className="link-underline hover:text-stone-600">Carrito (<CartCount count={cartCount} />)</Link>
          {signedIn ? (
            <AccountMenu items={account.items} extra={account.extra} unread={unread} />
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
        Compra y vende ropa en Monterrey
      </p>
    </div>
    </StoreSearchProvider>
  );
}

// Requests waiting for this courier's answer: the badge on PANEL and on "Solicitudes".
async function waitingCourierRequests(courierId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return 0;
  const { count } = await supabase.from("courier_requests").select("id", { count: "exact", head: true })
    .eq("courier_id", courierId).eq("status", "requested").gt("expires_at", new Date().toISOString());
  return count ?? 0;
}
