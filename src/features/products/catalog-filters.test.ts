import { describe, expect, it } from "vitest";
import { categoriesForSection } from "@/features/products/section-categories";
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

describe("categoriesForSection", () => {
  it("uses men's labels and drops dresses under Hombre", () => {
    const men = categoriesForSection("men");
    expect(men.map(({ value }) => value)).not.toContain("dresses");
    expect(men.find(({ value }) => value === "tops")?.label).toBe("Playeras y camisas");
  });

  it("keeps every category for Mujer and for the whole catalog", () => {
    expect(categoriesForSection("women")).toHaveLength(6);
    expect(categoriesForSection()).toHaveLength(6);
  });
});
