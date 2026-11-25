import { describe, expect, it } from "vitest";
import { categoriesFor, categoriesForSection, categoryLabel, isCategoryAllowed } from "@/features/products/section-categories";
import { demoProducts } from "@/features/products/demo-catalog";
import { applyCatalogFilters } from "@/features/products/filter-products";
import { buildCatalogQueryString, parseCatalogFilters } from "@/features/products/catalog-filters";

describe("parseCatalogFilters", () => {
  it("reads filters from shareable query parameters", () => {
    const filters = parseCatalogFilters({
      category: "dresses",
      size: "M",
      condition: "like_new",
      minPrice: "300",
      maxPrice: "900",
      hideSold: "1",
      sort: "price-asc",
      page: "2",
    });

    expect(filters).toEqual({
      category: "dresses",
      size: "M",
      condition: "like_new",
      minPrice: 300,
      maxPrice: 900,
      hideSold: true,
      sort: "price-asc",
      page: 2,
      showAll: false,
    });
  });

  it("ignores unsupported values and normalizes the page", () => {
    expect(parseCatalogFilters({ category: "furniture", sort: "random", page: "0", minPrice: "-50" })).toEqual({
      category: undefined,
      size: undefined,
      condition: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      hideSold: false,
      sort: "recent",
      page: 1,
      showAll: false,
    });
  });

  it("treats empty price inputs as unset", () => {
    expect(parseCatalogFilters({ minPrice: "", maxPrice: " " })).toMatchObject({
      minPrice: undefined,
      maxPrice: undefined,
    });
  });

  it("preserves filters when building a pagination URL", () => {
    const filters = parseCatalogFilters({ category: "tops", size: "S", hideSold: "1", sort: "price-desc" });
    expect(buildCatalogQueryString(filters, 2)).toBe("category=tops&size=S&hideSold=1&sort=price-desc&page=2");
  });
});

describe("applyCatalogFilters", () => {
  it("filters by condition, price range and category", () => {
    const filters = parseCatalogFilters({ category: "tops", condition: "new", minPrice: "400", maxPrice: "500" });
    const result = applyCatalogFilters(demoProducts, filters);

    expect(result.total).toBe(1);
    expect(result.products[0]?.name).toBe("Blusa de lino arena");
  });

  it("keeps sold items at the end and can hide them", () => {
    const visible = applyCatalogFilters(demoProducts, parseCatalogFilters({}));
    const hidden = applyCatalogFilters(demoProducts, parseCatalogFilters({ hideSold: "1" }));

    expect(visible.products.at(-1)?.sale_status).toBe("sold");
    expect(hidden.products).toHaveLength(16);
    expect(hidden.products.some((product) => product.sale_status === "sold")).toBe(false);
  });

  it("splits the catalog into Mujer and Hombre", () => {
    const men = applyCatalogFilters(demoProducts, parseCatalogFilters({ audience: "men" }));
    const women = applyCatalogFilters(demoProducts, parseCatalogFilters({ audience: "women" }));

    expect(men.total).toBe(7);
    expect(men.products.map((product) => product.name)).toEqual(expect.arrayContaining(["Camisa Oxford azul", "Pantalón chino caqui"]));
    expect(women.total).toBe(12);
    expect(women.products.some((product) => product.audience === "men")).toBe(false);
  });

  it("shows unisex garments in both sections", () => {
    const unisex = { ...demoProducts[0]!, id: "unisex", audience: "unisex" as const };
    const catalog = [...demoProducts, unisex];

    expect(applyCatalogFilters(catalog, parseCatalogFilters({ audience: "men" })).products.some((product) => product.id === "unisex")).toBe(true);
    expect(applyCatalogFilters(catalog, parseCatalogFilters({ audience: "women" })).products.some((product) => product.id === "unisex")).toBe(true);
  });

  it("ignores an unknown section", () => {
    expect(parseCatalogFilters({ audience: "kids" }).audience).toBeUndefined();
  });
});

describe("audience-aware category labels", () => {
  it("uses men's labels and drops dresses under Hombre", () => {
    const men = categoriesForSection("men");
    expect(men.map(({ value }) => value)).not.toContain("dresses");
    expect(men.map(({ label }) => label)).toEqual(["Camisas y playeras", "Pantalones y shorts", "Chamarras y sacos", "Calzado", "Accesorios"]);
  });

  it("keeps the original labels for Mujer", () => {
    expect(categoriesForSection("women").map(({ label }) => label)).toEqual(["Blusas y tops", "Pantalones y faldas", "Vestidos", "Chamarras y sacos", "Calzado", "Accesorios"]);
  });

  it("uses neutral labels and every category for Unisex and the whole catalog", () => {
    expect(categoriesFor("unisex")).toHaveLength(6);
    expect(categoriesForSection()).toHaveLength(6);
    expect(categoryLabel("tops", "unisex")).toBe("Playeras, camisas y tops");
    expect(categoryLabel("bottoms")).toBe("Pantalones, shorts y faldas");
  });

  it("labels one garment by its audience", () => {
    expect(categoryLabel("tops", "men")).toBe("Camisas y playeras");
    expect(categoryLabel("tops", "women")).toBe("Blusas y tops");
    // A men's dress saved before the rule still reads as a word.
    expect(categoryLabel("dresses", "men")).toBe("Vestidos");
  });

  it("rejects dresses for Hombre only", () => {
    expect(isCategoryAllowed("dresses", "men")).toBe(false);
    expect(isCategoryAllowed("dresses", "women")).toBe(true);
    expect(isCategoryAllowed("dresses", "unisex")).toBe(true);
    expect(isCategoryAllowed("tops", "men")).toBe(true);
    expect(isCategoryAllowed("socks", "women")).toBe(false);
  });
});

describe("delivery filter", () => {
  it("accepts a point id or home delivery and keeps it in shareable URLs", () => {
    const point = "60000000-0000-4000-8000-000000000001";
    expect(parseCatalogFilters({ entrega: point }).delivery).toBe(point);
    expect(parseCatalogFilters({ entrega: "domicilio" }).delivery).toBe("domicilio");
    expect(buildCatalogQueryString(parseCatalogFilters({ entrega: "domicilio" }))).toContain("entrega=domicilio");
  });

  it("ignores anything else", () => {
    expect(parseCatalogFilters({ entrega: "<script>" }).delivery).toBeUndefined();
  });
});

describe("new arrivals", () => {
  it("keeps ?ver=todo across pages", () => {
    const filters = parseCatalogFilters({ ver: "todo" });
    expect(filters.showAll).toBe(true);
    expect(buildCatalogQueryString(filters, 2)).toBe("ver=todo&page=2");
  });

  it("never reads the new-arrivals cutoff from the URL", () => {
    expect(parseCatalogFilters({ newSince: "2000-01-01" } as never).newSince).toBeUndefined();
  });

  it("keeps only garments published since the cutoff", () => {
    const cutoff = "2026-11-12T00:00:00.000Z";
    const result = applyCatalogFilters(demoProducts, { ...parseCatalogFilters({}), newSince: cutoff }, 100);
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThan(demoProducts.length);
    expect(result.products.every((product) => Date.parse(product.created_at) >= Date.parse(cutoff))).toBe(true);
  });
});
