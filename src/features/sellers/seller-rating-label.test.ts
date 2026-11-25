import { describe, expect, it } from "vitest";
import { sellerRatingLabel } from "@/features/sellers/seller-rating-label";

describe("sellerRatingLabel", () => {
  it("shows the average and how many ratings", () => {
    expect(sellerRatingLabel({ ratings: 12, rating: 4.75 }).text).toBe("★ 4.8 · 12 calificaciones");
    expect(sellerRatingLabel({ ratings: 1, rating: 5 }).text).toBe("★ 5.0 · 1 calificación");
  });
  it("calls a store with no ratings new instead of showing zero", () => {
    expect(sellerRatingLabel(null).text).toBe("Nuevo");
    expect(sellerRatingLabel({ ratings: 0, rating: 0 }).text).toBe("Nuevo");
  });
});
