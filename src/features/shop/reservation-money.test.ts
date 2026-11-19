import { describe, expect, it } from "vitest";
import { deliveryGroup, sellerBalanceAtDelivery } from "@/features/shop/reservation-money";

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
