import { describe, expect, it } from "vitest";
import { demoProducts } from "@/features/products/demo-catalog";
import {
  CURATED_SEARCH_TERMS,
  isLiveSearchable,
  mergePopularTerms,
  normalizeSearchText,
  parseSearchQuery,
  productMatchesSearch,
  searchResultsHref,
  searchTokens,
} from "@/features/search/search-query";

function matching(query: string) {
  const tokens = searchTokens(query);
  return demoProducts.filter((product) => productMatchesSearch(product, tokens)).map((product) => product.name);
}

describe("normalizeSearchText", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(normalizeSearchText("  ¡PANTALÓN   Niño!  ")).toBe("pantalon nino");
  });
});

// Same examples as supabase/tests/store_search.test.sql, so both copies of the rules agree.
describe("searchTokens", () => {
  it("drops plurals and filler words", () => {
    expect(searchTokens("  Vestidos de VERANO  ")).toEqual(["vestido", "verano"]);
  });

  it("collapses repeated words once accents are gone", () => {
    expect(searchTokens("PANTALÓN pantalones")).toEqual(["pantalon"]);
  });

  it("keeps sizes and numbers but not stray letters or 'talla'", () => {
    expect(searchTokens("talla M 28 x")).toEqual(["m", "28"]);
  });

  it("has nothing to search in punctuation", () => {
    expect(searchTokens("!!! ¿? ")).toEqual([]);
  });

  it("keeps at most six tokens", () => {
    expect(searchTokens("uno dos tres cuatro cinco seis siete")).toHaveLength(6);
  });
});

describe("parseSearchQuery", () => {
  it("tidies spaces and caps the length", () => {
    expect(parseSearchQuery("  vestido   rojo ")).toBe("vestido rojo");
    expect(parseSearchQuery("a".repeat(200))?.length).toBe(80);
  });

  it("is undefined when nothing is searchable", () => {
    expect(parseSearchQuery(undefined)).toBeUndefined();
    expect(parseSearchQuery("   ")).toBeUndefined();
    expect(parseSearchQuery("de la")).toBeUndefined();
  });
});

describe("isLiveSearchable", () => {
  it("waits for a real word, a size or a number", () => {
    expect(isLiveSearchable("ve")).toBe(false);
    expect(isLiveSearchable("ves")).toBe(true);
    expect(isLiveSearchable("m")).toBe(true);
    expect(isLiveSearchable("28")).toBe(true);
  });
});

describe("productMatchesSearch", () => {
  it("is accent- and case-insensitive", () => {
    expect(matching("PANTALÓN CHINO")).toEqual(["Pantalón chino caqui"]);
  });

  it("matches word prefixes while typing", () => {
    expect(matching("vest")).toEqual(["Vestido floral de verano", "Vestido satinado champaña"]);
  });

  it("finds the singular from a plural", () => {
    expect(matching("tenis")).toEqual(["Tenis blancos minimal", "Tenis de piel blancos"]);
  });

  it("searches the category label", () => {
    expect(matching("calzado")).toHaveLength(3);
  });

  it("matches sizes as whole words", () => {
    expect(matching("jeans 28")).toEqual(["Jeans rectos azul medio", "Jeans slim azul oscuro"]);
    expect(matching("vestido m")).toEqual(["Vestido satinado champaña"]);
  });

  it("requires every word to match", () => {
    expect(matching("vestido hombre zzz")).toEqual([]);
  });

  it("matches nothing without tokens", () => {
    expect(matching("de")).toEqual([]);
  });
});

describe("mergePopularTerms", () => {
  it("falls back to the curated list", () => {
    expect(mergePopularTerms([])).toEqual([...CURATED_SEARCH_TERMS]);
  });

  it("puts real terms first, fills with curated ones and avoids duplicates", () => {
    expect(mergePopularTerms(["jeans", "pantalon", "vestido rojo"])).toEqual(["Jeans", "Pantalón", "Vestido rojo", "Sudadera", "Vestido"]);
  });

  it("treats a plural and its singular as the same chip", () => {
    expect(mergePopularTerms(["vestidos", "blusas"])).toEqual(["Vestido", "Blusa", "Sudadera", "Pantalón", "Tenis"]);
  });

  it("respects the count", () => {
    expect(mergePopularTerms(["a1b", "c2d", "e3f"], 2)).toEqual(["A1b", "C2d"]);
  });
});

describe("searchResultsHref", () => {
  it("goes to the catalog with q", () => {
    expect(searchResultsHref(" vestido  rojo ")).toBe("/?q=vestido+rojo");
  });
});
