import { describe, expect, it } from "vitest";
import { sellerChecklist } from "@/features/sellers/seller-checklist";

const none = { hasClabe: false, hasDelivery: false, productCount: 0, sharedStore: false };

describe("sellerChecklist", () => {
  it("lists the four steps in order, CLABE first", () => {
    expect(sellerChecklist(none).steps.map((step) => step.label)).toEqual([
      "Pon tu CLABE para recibir anticipos", "Elige cómo entregas", "Sube tu primera prenda", "Comparte tu bazar",
    ]);
  });
  it("flags a missing CLABE so it can be shown first and loud", () => {
    expect(sellerChecklist(none).clabeMissing).toBe(true);
    expect(sellerChecklist({ ...none, hasClabe: true }).clabeMissing).toBe(false);
  });
  it("marks each step from real data and is done only when all are", () => {
    const partial = sellerChecklist({ hasClabe: true, hasDelivery: true, productCount: 2, sharedStore: false });
    expect(partial.steps.map((step) => step.done)).toEqual([true, true, true, false]);
    expect(partial.allDone).toBe(false);
    expect(sellerChecklist({ hasClabe: true, hasDelivery: true, productCount: 1, sharedStore: true }).allDone).toBe(true);
  });
});
