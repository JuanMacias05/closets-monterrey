import { describe, expect, it } from "vitest";
import { garmentShareDescription, garmentShareTitle, shortPrice, storeShareDescription } from "@/features/share/share-text";

describe("share text", () => {
  it("titles a garment with its name, whole-peso price and size", () => {
    expect(garmentShareTitle({ name: "Vestido floral", price_mxn: 65000, size: "M" })).toBe("Vestido floral · $650 · Talla M");
    expect(shortPrice(125000)).toBe("$1,250");
    expect(shortPrice(35050)).toBe("$350.50");
  });

  it("names the closet and the condition", () => {
    expect(garmentShareDescription({ condition: "like_new", seller: { store_name: "Closet de Renata" } })).toBe("De Closet de Renata · Como nuevo · BZRS Monterrey");
  });

  it("says how many garments a store has", () => {
    expect(storeShareDescription("Closet de Renata", 1)).toBe("Closet de Renata en BZRS Monterrey · 1 prenda disponible");
    expect(storeShareDescription("Closet de Renata", 12)).toContain("12 prendas disponibles");
  });
});
