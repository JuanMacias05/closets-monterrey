import { describe, expect, it } from "vitest";
import { buildProductImageStoragePath } from "@/features/products/product-image-upload";

describe("buildProductImageStoragePath", () => {
  it("uses the seller/product prefix and a unique opaque filename", () => {
    expect(buildProductImageStoragePath(
      "10000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000001",
      "a7k2-uuid",
    )).toBe("sellers/10000000-0000-4000-8000-000000000001/products/20000000-0000-4000-8000-000000000001/a7k2-uuid.jpg");
  });
});
