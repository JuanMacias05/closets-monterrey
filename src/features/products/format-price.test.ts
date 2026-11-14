import { describe, expect, it } from "vitest";
import { formatPriceMXN } from "@/features/products/format-price";

describe("formatPriceMXN", () => {
  it("formats cents as Mexican pesos with two decimals", () => {
    expect(formatPriceMXN(35000)).toBe("$350.00 MXN");
    expect(formatPriceMXN(125050)).toBe("$1,250.50 MXN");
  });
});
