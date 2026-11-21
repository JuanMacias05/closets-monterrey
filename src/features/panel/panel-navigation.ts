// What the panel's side menu lists. "Tu clóset" is every approved seller's own tools; the admin
// group is only passed to the menu when profiles.role = 'admin' (the layout checks it, and each
// admin page checks it again on its own). Couriers get the same frame with their own menu
// (courierNavGroups), under /recolectora.

export type PanelNavIcon =
  | "home" | "garments" | "add" | "reservations" | "store" | "live"
  | "sellers" | "buyers" | "couriers" | "allGarments" | "support" | "rates"
  | "requests" | "route" | "profile" | "ratings" | "messages";

export type PanelNavItem = {
  label: string;
  icon: PanelNavIcon;
  // null = shown but not available yet ("Próximamente"); it must never link anywhere.
  href: string | null;
  // Things waiting for her there (e.g. courier requests to answer). Hidden at 0.
  badge?: { count: number; label: string };
};

export type PanelNavGroup = { id: string; label: string; items: PanelNavItem[] };

export const SELLER_NAV_GROUP: PanelNavGroup = {
  id: "panel-nav-store",
  label: "Tu clóset",
  items: [
    { label: "Inicio", icon: "home", href: "/panel" },
    { label: "Mis prendas", icon: "garments", href: "/panel/prendas" },
    // "Subir prenda", not "Agregar prenda": it is the same action as the panel's main button,
    // and two names for one action read as two different things (see panel-styles.ts).
    { label: "Subir prenda", icon: "add", href: "/panel/prendas/nueva" },
    { label: "Apartados", icon: "reservations", href: "/panel/apartados" },
    // Chats with buyers and couriers (20261125000100); the count of unread comes from the layout.
    { label: "Mensajes", icon: "messages", href: "/panel/mensajes" },
    // Couriers who collect at her points: who can take her buyers' orders.
    { label: "Recolectoras", icon: "couriers", href: "/panel/recolectoras" },
    { label: "Mi tienda", icon: "store", href: "/panel/tienda" },
    // Live sales are planned, not built: the item announces them without a route behind it.
    { label: "En vivo", icon: "live", href: null },
  ],
};

export const ADMIN_NAV_GROUP: PanelNavGroup = {
  id: "panel-nav-admin",
  label: "Administración del sitio",
  items: [
    { label: "Vendedoras", icon: "sellers", href: "/panel/admin/vendedoras" },
    { label: "Clientas", icon: "buyers", href: "/panel/admin/clientas" },
    // Not just "Recolectoras": an admin also has the seller's "Recolectoras" above.
    { label: "Verificar recolectoras", icon: "couriers", href: "/panel/admin/recolectoras" },
    { label: "Tarifas de envío", icon: "rates", href: "/panel/admin/tarifas-envio" },
    { label: "Todas las prendas", icon: "allGarments", href: "/panel/admin/prendas" },
    { label: "Soporte", icon: "support", href: "/panel/admin/soporte" },
  ],
};

export function panelNavGroups(isAdmin: boolean, unreadMessages = 0): PanelNavGroup[] {
  const seller = { ...SELLER_NAV_GROUP, items: SELLER_NAV_GROUP.items.map((item) => (item.href === "/panel/mensajes" ? { ...item, badge: unreadBadge(unreadMessages) } : item)) };
  return isAdmin ? [seller, ADMIN_NAV_GROUP] : [seller];
}

function unreadBadge(count: number): PanelNavItem["badge"] {
  return count > 0 ? { count, label: count === 1 ? "1 mensaje sin leer" : `${count} mensajes sin leer` } : undefined;
}

// A courier's area. "Solicitudes" comes first and carries the count of requests waiting for
// her answer: each one expires in 2 hours, so it is the thing she must not miss.
export function courierNavGroups(pendingRequests: number, unreadMessages = 0): PanelNavGroup[] {
  return [
    {
      id: "panel-nav-courier",
      label: "Tus entregas",
      items: [
        {
          label: "Solicitudes",
          icon: "requests",
          href: "/recolectora/solicitudes",
          badge: pendingRequests > 0 ? { count: pendingRequests, label: pendingRequests === 1 ? "1 por responder" : `${pendingRequests} por responder` } : undefined,
        },
        { label: "Mis entregas", icon: "couriers", href: "/recolectora" },
        { label: "Mensajes", icon: "messages", href: "/recolectora/mensajes", badge: unreadBadge(unreadMessages) },
        { label: "Mi ruta", icon: "route", href: "/recolectora/ruta" },
        { label: "Mi perfil", icon: "profile", href: "/recolectora/perfil" },
        { label: "Calificaciones", icon: "ratings", href: "/recolectora/calificaciones" },
      ],
    },
  ];
}

/**
 * The menu entry the current page belongs to: the longest href that is the path itself or one
 * of its parents. Longest wins so "/panel/prendas/nueva" lights "Subir prenda" and not also
 * "Mis prendas", while a garment's edit page ("/panel/prendas/<id>") still lights "Mis prendas".
 */
export function activePanelHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "closets:panel-sidebar-collapsed";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

// Storage can be missing or throw (private window, blocked site data); the menu then simply
// starts expanded and the choice lasts until the page reloads.
export function readSidebarCollapsed(storage: ReadableStorage | null | undefined): boolean {
  try {
    return storage?.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(storage: WritableStorage | null | undefined, collapsed: boolean): void {
  try {
    storage?.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Not remembered on this device; the in-memory choice still applies.
  }
}
