import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProductImageStoragePath, prepareProductImage } from "@/features/products/product-image-upload";

afterEach(() => vi.unstubAllGlobals());

describe("buildProductImageStoragePath", () => {
  it("uses the seller/product prefix and a unique opaque filename", () => {
    expect(buildProductImageStoragePath(
      "10000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000001",
      "a7k2-uuid",
    )).toBe("sellers/10000000-0000-4000-8000-000000000001/products/20000000-0000-4000-8000-000000000001/a7k2-uuid.jpg");
  });
});

describe("prepareProductImage", () => {
  it("shows a clear Spanish message when the browser cannot decode a photo", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new DOMException("The source image could not be decoded.")));
    const file = new File(["bad image"], "photo.heic", { type: "image/heic" });

    await expect(prepareProductImage(file)).rejects.toThrow(
      "No pudimos leer esta foto. Prueba con otra o toma una captura.",
    );
  });
});
