import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_GROUP,
  BUYER_ONLY,
  COURIER_PENDING_NOTE,
  SELLER_NAV_GROUP,
  SELLER_PENDING_NOTE,
  accountMenu,
  activePanelHref,
  canUploadGarments,
  hasPanel,
  panelBadgeTotal,
  panelMenuGroups,
  panelMenuLabel,
  panelTag,
} from "@/features/panel/panel-navigation";

const labels = (flags: Parameters<typeof panelMenuGroups>[0], pending = 0) => panelMenuGroups(flags, pending).map((group) => group.label);

describe("panelMenuGroups", () => {
  it("gives a buyer-only account no panel at all", () => {
    expect(panelMenuGroups(BUYER_ONLY)).toEqual([]);
    expect(hasPanel(BUYER_ONLY)).toBe(false);
  });

  it("gives a courier only Tus entregas", () => {
    expect(labels({ seller: null, courier: "approved", admin: false })).toEqual(["Tus entregas"]);
  });

  it("gives a seller who also delivers both columns, in a fixed order", () => {
    expect(labels({ seller: "approved", courier: "approved", admin: false })).toEqual(["Tu clóset", "Tus entregas"]);
  });

  it("adds the site administration for an admin, who may also deliver", () => {
    expect(labels({ seller: "approved", courier: "approved", admin: true })).toEqual(["Tu clóset", "Tus entregas", "Administración del sitio"]);
    expect(labels({ seller: null, courier: null, admin: true })).toEqual(["Administración del sitio"]);
  });

  it("shows only a note while an activity waits for approval", () => {
    const [store, deliveries] = panelMenuGroups({ seller: "pending", courier: "pending", admin: false });
    expect(store).toMatchObject({ label: "Tu clóset", items: [], note: SELLER_PENDING_NOTE });
    expect(deliveries).toMatchObject({ label: "Tus entregas", items: [], note: COURIER_PENDING_NOTE });
    expect(hasPanel({ seller: "pending", courier: null, admin: false })).toBe(true);
  });

  it("keeps chats out of the panel: they are in Mi cuenta", () => {
    const hrefs = panelMenuGroups({ seller: "approved", courier: "approved", admin: true }).flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs.some((href) => href?.includes("mensajes"))).toBe(false);
  });

  it("ends the admin group with Ver como clienta, an action, not a page", () => {
    expect(ADMIN_NAV_GROUP.items.at(-1)).toMatchObject({ label: "Ver como clienta", href: null, action: "view-as-buyer" });
  });

  it("announces live sales without linking anywhere", () => {
    expect(SELLER_NAV_GROUP.items.find((item) => item.label === "En vivo")?.href).toBeNull();
  });
});

describe("the green bar", () => {
  it("offers Subir prenda only to an approved seller or an admin", () => {
    expect(canUploadGarments({ seller: "approved", courier: null, admin: false })).toBe(true);
    expect(canUploadGarments({ seller: "pending", courier: null, admin: false })).toBe(false);
    expect(canUploadGarments({ seller: null, courier: "approved", admin: false })).toBe(false);
    expect(canUploadGarments({ seller: null, courier: null, admin: true })).toBe(true);
  });

  it("tags who she is", () => {
    expect(panelTag({ seller: "approved", courier: "approved", admin: false })).toBe("Vendedora · Recolectora");
    expect(panelTag({ seller: null, courier: "pending", admin: false })).toBe("Recolectora");
    expect(panelTag({ seller: "approved", courier: null, admin: true })).toBe("Administración");
  });

  it("counts courier requests waiting as the PANEL badge", () => {
    expect(panelBadgeTotal(panelMenuGroups({ seller: "approved", courier: "approved", admin: false }, 2))).toBe(2);
    expect(panelBadgeTotal(panelMenuGroups({ seller: null, courier: "pending", admin: false }, 2))).toBe(0);
  });

  it("says which page she is on", () => {
    const groups = panelMenuGroups({ seller: "approved", courier: "approved", admin: true });
    expect(panelMenuLabel("/", groups)).toBe("Panel");
    expect(panelMenuLabel("/panel/prendas/nueva", groups)).toBe("Panel · Subir prenda");
    expect(panelMenuLabel("/panel/prendas/3f1c2a9e-0000-4000-8000-000000000001", groups)).toBe("Panel · Mis prendas");
    expect(panelMenuLabel("/recolectora/solicitudes", groups)).toBe("Panel · Solicitudes");
    expect(panelMenuLabel("/panel/admin/vendedoras", groups)).toBe("Panel · Vendedoras");
  });
});

describe("activePanelHref", () => {
  const hrefs = [...SELLER_NAV_GROUP.items, ...ADMIN_NAV_GROUP.items].flatMap((item) => (item.href ? [item.href] : []));

  it("does not mistake the admin garments page for the seller's own list", () => {
    expect(activePanelHref("/panel/admin/prendas", hrefs)).toBe("/panel/admin/prendas");
  });

  it("does not match a sibling that only shares a prefix", () => {
    expect(activePanelHref("/panel/tiendas", ["/panel/tienda"])).toBeNull();
  });
});

describe("accountMenu", () => {
  it("gives everyone purchases, one inbox, favorites and notifications", () => {
    expect(accountMenu(BUYER_ONLY, 0).items.map((item) => item.label)).toEqual(["Mis compras", "Mensajes", "Favoritos", "Avisos"]);
  });

  it("counts unread messages on Mensajes", () => {
    expect(accountMenu(BUYER_ONLY, 3).items[1]!.badge).toEqual({ count: 3, label: "3 mensajes sin leer" });
  });

  it("offers to sell or deliver only what she doesn't do yet, and nothing to an admin", () => {
    expect(accountMenu(BUYER_ONLY, 0).extra.map((item) => item.label)).toEqual(["Quiero vender", "Quiero entregar"]);
    expect(accountMenu({ seller: "pending", courier: null, admin: false }, 0).extra.map((item) => item.label)).toEqual(["Quiero entregar"]);
    expect(accountMenu({ seller: null, courier: "approved", admin: false }, 0).extra.map((item) => item.label)).toEqual(["Quiero vender"]);
    expect(accountMenu({ seller: null, courier: null, admin: true }, 0).extra).toEqual([]);
  });
});
