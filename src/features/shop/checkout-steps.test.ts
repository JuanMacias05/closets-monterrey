import { describe, expect, it } from "vitest";
import {
  couriersFor,
  deliveryDraftError,
  describeDraft,
  draftToChoice,
  initialDeliveryDraft,
  summarizeDraft,
  type SellerDeliveryOptions,
} from "@/features/shop/checkout-steps";

const lupita = { id: "c1", fullName: "Lupita", municipalities: ["Monterrey", "Guadalupe"], feeMxn: 4500, pointNames: ["Padre Mier"], days: [2], timeWindow: null, rating: 4.8, deliveries: 3 };
const rosa = { ...lupita, id: "c2", fullName: "Rosa", municipalities: ["Monterrey"], feeMxn: 5000 };
const options: SellerDeliveryOptions = {
  points: [{ id: "p1", name: "Padre Mier" }],
  homeDelivery: { origin: "Monterrey", note: null, feesByMunicipality: { Monterrey: 6000 } },
  couriers: [lupita, rosa],
};
const arrangedOnly: SellerDeliveryOptions = { points: [], homeDelivery: null, couriers: [] };

describe("initialDeliveryDraft", () => {
  it("starts on the first fixed point, without a courier", () => {
    expect(initialDeliveryDraft(options)).toMatchObject({ wantsCourier: false, choice: "point:p1" });
  });
  it("falls back to arranging it with the seller", () => {
    expect(initialDeliveryDraft(arrangedOnly).choice).toBe("arranged");
  });
});

describe("couriersFor", () => {
  it("lists couriers covering the municipality, minus those who said no", () => {
    expect(couriersFor(options, "Monterrey").map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(couriersFor(options, "Monterrey", ["c1"]).map((c) => c.id)).toEqual(["c2"]);
    expect(couriersFor(options, "")).toEqual([]);
  });
});

describe("deliveryDraftError", () => {
  const base = initialDeliveryDraft(options);
  const address = "Calle Hidalgo 123, Centro";

  it("lets a fixed point through", () => {
    expect(deliveryDraftError(options, base)).toBeNull();
  });
  it("asks for municipality, a courier and an address in order", () => {
    const courier = { ...base, wantsCourier: true };
    expect(deliveryDraftError(options, courier)).toMatch(/Elige tu municipio/);
    expect(deliveryDraftError(options, { ...courier, municipality: "Apodaca" })).toMatch(/Nadie más recolecta en Apodaca/);
    expect(deliveryDraftError(options, { ...courier, municipality: "Monterrey" })).toBe("Elige quién recolecta.");
    expect(deliveryDraftError(options, { ...courier, municipality: "Monterrey", courierId: "c1" })).toMatch(/dirección completa/);
    expect(deliveryDraftError(options, { ...courier, municipality: "Monterrey", courierId: "c1", address })).toBeNull();
  });
  it("does not accept a courier who already said no", () => {
    expect(deliveryDraftError(options, { ...base, wantsCourier: true, municipality: "Monterrey", courierId: "c1", address }, ["c1"])).toBe("Elige quién recolecta.");
  });
  it("needs a zone rate for home delivery", () => {
    expect(deliveryDraftError(options, { ...base, choice: "home", municipality: "Apodaca", address })).toMatch(/no hay tarifa de envío a Apodaca/);
    expect(deliveryDraftError(options, { ...base, choice: "home", municipality: "Monterrey", address })).toBeNull();
  });
});

describe("summarizeDraft / draftToChoice / describeDraft", () => {
  it("prices a courier and builds the reservation call", () => {
    const draft = { ...initialDeliveryDraft(options), wantsCourier: true, municipality: "Monterrey", courierId: "c2", feePayment: "with_deposit" as const, address: " Calle 1 #2, Centro " };
    const summary = summarizeDraft(options, draft);
    expect(summary).toMatchObject({ method: "courier", feeMxn: 5000 });
    expect(draftToChoice(options, draft)).toEqual({ method: "courier", courierId: "c2", municipality: "Monterrey", address: "Calle 1 #2, Centro", feePayment: "with_deposit" });
    expect(describeDraft(summary, draft)).toBe("Recolección ✓ Rosa a Monterrey · su tarifa va incluida en tu anticipo");
  });
  it("keeps the fee unknown until a municipality prices home delivery", () => {
    expect(summarizeDraft(options, { ...initialDeliveryDraft(options), choice: "home" }).feeMxn).toBeNull();
  });
  it("arranges with the seller when she offers nothing else", () => {
    expect(draftToChoice(arrangedOnly, initialDeliveryDraft(arrangedOnly))).toEqual({ method: "arranged" });
  });
});
