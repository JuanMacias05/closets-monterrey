import { describe, expect, it } from "vitest";
import { checkoutQuote, deliveryFeeChange, deliveryGroup, depositForGarments, sellerBalanceAtDelivery } from "@/features/shop/reservation-money";

const base = { items_total_mxn: 100000, deposit_mxn: 20000, delivery_method: "pickup_point", delivery_fee_mxn: 0, courier_fee_payment: null };

describe("sellerBalanceAtDelivery", () => {
  it("is the garments' total minus the deposit at a fixed point", () => {
    expect(sellerBalanceAtDelivery(base)).toBe(80000);
  });

  it("adds the seller's home-delivery fee", () => {
    expect(sellerBalanceAtDelivery({ ...base, delivery_method: "home_delivery", delivery_fee_mxn: 5000 })).toBe(85000);
  });

  it("does not count a courier fee paid with the deposit as money toward the garments", () => {
    expect(sellerBalanceAtDelivery({ ...base, delivery_method: "courier", delivery_fee_mxn: 4500, deposit_mxn: 24500, courier_fee_payment: "with_deposit" })).toBe(80000);
  });

  it("leaves a courier fee paid on delivery to the courier", () => {
    expect(sellerBalanceAtDelivery({ ...base, delivery_method: "courier", delivery_fee_mxn: 4500, courier_fee_payment: "on_delivery" })).toBe(80000);
  });

  it("never goes below zero", () => {
    expect(sellerBalanceAtDelivery({ ...base, deposit_mxn: 150000 })).toBe(0);
  });
});

describe("deliveryGroup", () => {
  it.each([
    [{ delivery_method: "pickup_point", point: { name: "Padre Mier" }, courier: null }, "punto:Padre Mier"],
    [{ delivery_method: "courier", point: null, courier: { full_name: "Lupita" } }, "recolectora:Lupita"],
    [{ delivery_method: "home_delivery", point: null, courier: null }, "domicilio"],
    [{ delivery_method: "arranged", point: null, courier: null }, "acordar"],
  ])("groups %o under %s", (input, key) => expect(deliveryGroup(input).key).toBe(key));
});

describe("depositForGarments", () => {
  it("rounds a 20% deposit up to whole pesos, like the reservation function", () => {
    expect(depositForGarments(35050, 20)).toBe(7100);
    expect(depositForGarments(48000, 20)).toBe(9600);
  });
});

describe("checkoutQuote", () => {
  const cart = { itemsTotalMxn: 48000, depositPercent: 20, courierFeePayment: null };

  it("adds the home-delivery estimate to the total but not to the deposit", () => {
    expect(checkoutQuote({ ...cart, deliveryMethod: "home_delivery", deliveryFeeMxn: 9000 })).toEqual({ depositMxn: 9600, totalMxn: 57000, dueAtDeliveryMxn: 47400 });
  });

  it("is the garments alone until the buyer picks her municipality", () => {
    expect(checkoutQuote({ ...cart, deliveryMethod: "home_delivery", deliveryFeeMxn: null })).toEqual({ depositMxn: 9600, totalMxn: 48000, dueAtDeliveryMxn: 38400 });
  });

  it("carries a courier fee in the deposit only when she pays it with the deposit", () => {
    expect(checkoutQuote({ ...cart, deliveryMethod: "courier", deliveryFeeMxn: 4500, courierFeePayment: "with_deposit" }).depositMxn).toBe(14100);
    expect(checkoutQuote({ ...cart, deliveryMethod: "courier", deliveryFeeMxn: 4500, courierFeePayment: "on_delivery" }).depositMxn).toBe(9600);
  });

  it("costs nothing extra at a fixed point", () => {
    expect(checkoutQuote({ ...cart, deliveryMethod: "pickup_point", deliveryFeeMxn: 0 })).toEqual({ depositMxn: 9600, totalMxn: 48000, dueAtDeliveryMxn: 38400 });
  });
});

describe("deliveryFeeChange", () => {
  const home = { delivery_method: "home_delivery", delivery_fee_mxn: 12000, delivery_fee_estimate_mxn: 9000, delivery_fee_adjusted_at: "2026-11-20T18:00:00Z" };

  it("reports the seller's adjustment from the estimate to the new fee", () => {
    expect(deliveryFeeChange(home)).toEqual({ fromMxn: 9000, toMxn: 12000 });
  });

  it("says nothing when she never adjusted it or set it back to the estimate", () => {
    expect(deliveryFeeChange({ ...home, delivery_fee_adjusted_at: null })).toBeNull();
    expect(deliveryFeeChange({ ...home, delivery_fee_mxn: 9000 })).toBeNull();
  });

  it("says nothing for reservations made before zone rates, which have no estimate", () => {
    expect(deliveryFeeChange({ ...home, delivery_fee_estimate_mxn: null })).toBeNull();
  });
});
