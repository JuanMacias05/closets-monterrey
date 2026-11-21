import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_GROUP,
  SELLER_NAV_GROUP,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  activePanelHref,
  courierNavGroups,
  panelNavGroups,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "@/features/panel/panel-navigation";

const hrefs = [...SELLER_NAV_GROUP.items, ...ADMIN_NAV_GROUP.items]
  .map((item) => item.href)
  .filter((href): href is string => href !== null);

describe("activePanelHref", () => {
  it("lights Inicio only on the panel home", () => {
    expect(activePanelHref("/panel", hrefs)).toBe("/panel");
  });

  it("lights Subir prenda, not Mis prendas, on the new-garment form", () => {
    expect(activePanelHref("/panel/prendas/nueva", hrefs)).toBe("/panel/prendas/nueva");
  });

  it("keeps Mis prendas lit while a garment is being edited", () => {
    expect(activePanelHref("/panel/prendas/3f1c2a9e-0000-4000-8000-000000000001", hrefs)).toBe("/panel/prendas");
  });

  it("does not mistake the admin garments page for the seller's own list", () => {
    expect(activePanelHref("/panel/admin/prendas", hrefs)).toBe("/panel/admin/prendas");
  });

  it("does not match a sibling that only shares a prefix", () => {
    expect(activePanelHref("/panel/tiendas", ["/panel/tienda"])).toBeNull();
  });
});

describe("panelNavGroups", () => {
  it("shows a seller only her own tools", () => {
    expect(panelNavGroups(false)).toEqual([SELLER_NAV_GROUP]);
  });

  it("adds the site administration for an admin", () => {
    expect(panelNavGroups(true)).toEqual([SELLER_NAV_GROUP, ADMIN_NAV_GROUP]);
  });

  it("announces live sales without linking anywhere", () => {
    expect(SELLER_NAV_GROUP.items.find((item) => item.label === "En vivo")?.href).toBeNull();
  });
});

describe("courierNavGroups", () => {
  const items = courierNavGroups(0)[0]!.items;

  it("lists the courier's sections, requests first", () => {
    expect(items.map((item) => item.label)).toEqual(["Solicitudes", "Mis entregas", "Mensajes", "Mi ruta", "Mi perfil", "Calificaciones"]);
  });

  it("lights each section on its own page and Mis entregas on the area's home", () => {
    const hrefs = items.map((item) => item.href!);
    expect(activePanelHref("/recolectora/solicitudes", hrefs)).toBe("/recolectora/solicitudes");
    expect(activePanelHref("/recolectora", hrefs)).toBe("/recolectora");
  });

  it("counts requests waiting for an answer, and shows nothing at zero", () => {
    expect(items[0]!.badge).toBeUndefined();
    expect(courierNavGroups(2)[0]!.items[0]!.badge).toEqual({ count: 2, label: "2 por responder" });
    expect(courierNavGroups(1)[0]!.items[0]!.badge?.label).toBe("1 por responder");
  });
});

describe("unread messages", () => {
  it("shows the count on Mensajes for sellers and couriers", () => {
    const seller = panelNavGroups(false, 3)[0]!.items.find((item) => item.href === "/panel/mensajes");
    expect(seller?.badge).toEqual({ count: 3, label: "3 mensajes sin leer" });
    expect(courierNavGroups(0, 1)[0]!.items.find((item) => item.href === "/recolectora/mensajes")?.badge?.label).toBe("1 mensaje sin leer");
    expect(panelNavGroups(false, 0)[0]!.items.find((item) => item.href === "/panel/mensajes")?.badge).toBeUndefined();
  });
});

describe("seller and admin courier entries", () => {
  it("gives sellers the couriers at their points and keeps verification for admins", () => {
    expect(SELLER_NAV_GROUP.items.find((item) => item.href === "/panel/recolectoras")?.label).toBe("Recolectoras");
    expect(ADMIN_NAV_GROUP.items.find((item) => item.href === "/panel/admin/recolectoras")?.label).toBe("Verificar recolectoras");
  });
});

describe("sidebar collapsed preference", () => {
  it("round-trips through storage", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
    writeSidebarCollapsed(storage, true);
    expect(values.get(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("1");
    expect(readSidebarCollapsed(storage)).toBe(true);
    writeSidebarCollapsed(storage, false);
    expect(readSidebarCollapsed(storage)).toBe(false);
  });

  it("starts expanded when storage is missing or throws", () => {
    const broken = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
    };
    expect(readSidebarCollapsed(undefined)).toBe(false);
    expect(readSidebarCollapsed(broken)).toBe(false);
    expect(() => writeSidebarCollapsed(broken, true)).not.toThrow();
  });
});
