import { describe, expect, it } from "vitest";
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
    expect(hidden.products).toHaveLength(9);
    expect(hidden.products.some((product) => product.sale_status === "sold")).toBe(false);
  });
});
