// What the "PANEL ▾" menu in the green top bar and the "MI CUENTA ▾" menu list (accounts and menu
// proposal, approved 2026-11-21). One account can hold several activities (20261127000100), so
// the panel menu shows one column per activity: "Tu bazar" (selling), "Tus entregas"
// (delivering) and "Administración del sitio" (admin).
//
// IMPORTANT: these lists only decide which links to draw. Every page re-checks access on the
// server, and the database checks it again.

export type ActivityStatus = "pending" | "approved" | "suspended";

export type PanelNavIcon =
  | "home" | "garments" | "add" | "reservations" | "store" | "live"
  | "sellers" | "buyers" | "couriers" | "allGarments" | "support" | "rates"
  | "requests" | "route" | "profile" | "ratings" | "messages"
  | "verify" | "eye" | "bag" | "heart" | "bell" | "signOut";

export type PanelNavItem = {
  label: string;
  icon: PanelNavIcon;
  // null = shown but not available yet ("Próximamente"), unless it is an action.
  href: string | null;
  // Things waiting for her there (e.g. courier requests to answer). Hidden at 0.
  badge?: { count: number; label: string };
  // Not a page: "Ver como cliente" switches how the store is drawn (a server action).
  action?: "view-as-buyer";
};

// A group with `note` shows only that sentence: the activity is waiting or stopped.
export type PanelNavGroup = { id: string; label: string; items: PanelNavItem[]; note?: string };

export type ActivityFlags = { seller: ActivityStatus | null; courier: ActivityStatus | null; admin: boolean };

export const SELLER_NAV_GROUP: PanelNavGroup = {
  id: "panel-nav-store",
  label: "Tu bazar",
  items: [
    { label: "Inicio", icon: "home", href: "/panel" },
    { label: "Mis prendas", icon: "garments", href: "/panel/prendas" },
    // "Subir prenda", not "Agregar prenda": it is the same action as the green bar's button,
    // and two names for one action read as two different things.
    { label: "Subir prenda", icon: "add", href: "/panel/prendas/nueva" },
    { label: "Apartados", icon: "reservations", href: "/panel/apartados" },
    { label: "Calificaciones", icon: "ratings", href: "/panel/calificaciones" },
    // Couriers who collect at her points: who can take her buyers' orders.
    { label: "Recolección", icon: "couriers", href: "/panel/recolectoras" },
    { label: "Mi bazar", icon: "store", href: "/panel/tienda" },
    // Live sales are planned, not built: the item announces them without a route behind it.
    { label: "En vivo", icon: "live", href: null },
  ],
};

export const ADMIN_NAV_GROUP: PanelNavGroup = {
  id: "panel-nav-admin",
  label: "Administración del sitio",
  items: [
    { label: "Bazares", icon: "sellers", href: "/panel/admin/vendedoras" },
    { label: "Clientes", icon: "buyers", href: "/panel/admin/clientas" },
    // Not just "Recolección": a seller-admin also has "Recolección" in Tu bazar.
    { label: "Verificar quién entrega", icon: "verify", href: "/panel/admin/recolectoras" },
    { label: "Tarifas de envío", icon: "rates", href: "/panel/admin/tarifas-envio" },
    { label: "Todas las prendas", icon: "allGarments", href: "/panel/admin/prendas" },
    { label: "Soporte", icon: "support", href: "/panel/admin/soporte" },
    { label: "Ver como cliente", icon: "eye", href: null, action: "view-as-buyer" },
  ],
};

export const SELLER_PENDING_NOTE = "Tu bazar está en revisión. Te avisamos en cuanto la administración lo apruebe.";
export const SELLER_SUSPENDED_NOTE = "Tu bazar está suspendido. Comunícate con la administración si necesitas ayuda.";
export const COURIER_PENDING_NOTE = "Falta tu verificación: la administración te cita para revisar tu identificación.";
export const COURIER_SUSPENDED_NOTE = "Tu cuenta para entregar está suspendida. Comunícate con la administración.";

// A courier's sections. "Solicitudes" carries the count of requests waiting for her answer:
// each one expires in 2 hours, so it is the thing she must not miss. Her chats are in Mi cuenta.
export function courierNavGroup(pendingRequests: number): PanelNavGroup {
  return {
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
      { label: "Mi ruta", icon: "route", href: "/recolectora/ruta" },
      { label: "Mi perfil", icon: "profile", href: "/recolectora/perfil" },
      { label: "Calificaciones", icon: "ratings", href: "/recolectora/calificaciones" },
    ],
  };
}

// The panel menu's columns for this account, in a fixed order.
export function panelMenuGroups(flags: ActivityFlags, pendingRequests = 0): PanelNavGroup[] {
  const groups: PanelNavGroup[] = [];
  if (flags.seller === "approved") groups.push(SELLER_NAV_GROUP);
  else if (flags.seller) groups.push({ id: SELLER_NAV_GROUP.id, label: SELLER_NAV_GROUP.label, items: [], note: flags.seller === "pending" ? SELLER_PENDING_NOTE : SELLER_SUSPENDED_NOTE });
  const courier = courierNavGroup(pendingRequests);
  if (flags.courier === "approved") groups.push(courier);
  else if (flags.courier) groups.push({ id: courier.id, label: courier.label, items: [], note: flags.courier === "pending" ? COURIER_PENDING_NOTE : COURIER_SUSPENDED_NOTE });
  if (flags.admin) groups.push(ADMIN_NAV_GROUP);
  return groups;
}

// The green bar exists only for accounts with something beyond buying.
export function hasPanel(flags: ActivityFlags): boolean {
  return flags.seller !== null || flags.courier !== null || flags.admin;
}

// "+ SUBIR PRENDA" is for an approved seller or an admin.
export function canUploadGarments(flags: ActivityFlags): boolean {
  return flags.seller === "approved" || flags.admin;
}

// The green bar's tag: who she is in the panel.
export function panelTag(flags: ActivityFlags): string {
  if (flags.admin) return "Administración";
  return [flags.seller && "Vende", flags.courier && "Entrega"].filter(Boolean).join(" · ");
}

export function panelBadgeTotal(groups: readonly PanelNavGroup[]): number {
  return groups.reduce((sum, group) => sum + group.items.reduce((count, item) => count + (item.badge?.count ?? 0), 0), 0);
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

// "PANEL" on the storefront, "PANEL · MIS PRENDAS" on a panel page: the button says where she is.
export function panelMenuLabel(pathname: string, groups: readonly PanelNavGroup[]): string {
  const items = groups.flatMap((group) => group.items).filter((item) => item.href !== null);
  const active = activePanelHref(pathname, items.map((item) => item.href!));
  const item = items.find((candidate) => candidate.href === active);
  return item ? `Panel · ${item.label}` : "Panel";
}

// "MI CUENTA ▾": what every signed-in account has, plus "Hacer algo más" for activities she
// can still ask for. An admin asks for nothing: another admin grants her activities.
export function accountMenu(flags: ActivityFlags, unreadMessages: number): { items: PanelNavItem[]; extra: PanelNavItem[] } {
  const items: PanelNavItem[] = [
    { label: "Mis compras", icon: "bag", href: "/cuenta" },
    {
      label: "Mensajes",
      icon: "messages",
      href: "/cuenta/mensajes",
      badge: unreadMessages > 0 ? { count: unreadMessages, label: unreadMessages === 1 ? "1 mensaje sin leer" : `${unreadMessages} mensajes sin leer` } : undefined,
    },
    { label: "Favoritos", icon: "heart", href: "/favoritos" },
    { label: "Avisos", icon: "bell", href: "/cuenta/avisos" },
  ];
  const extra: PanelNavItem[] = [];
  if (!flags.seller && !flags.admin) extra.push({ label: "Quiero vender", icon: "store", href: "/cuenta/vender" });
  if (!flags.courier && !flags.admin) extra.push({ label: "Quiero entregar", icon: "couriers", href: "/cuenta/entregar" });
  return { items, extra };
}

// What a buyer-only account has: "Ver como cliente" draws the store with these flags.
export const BUYER_ONLY: ActivityFlags = { seller: null, courier: null, admin: false };
