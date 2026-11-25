import { describe, expect, it } from "vitest";
import { courierExpiryPushes, isAuthorizedCronRequest, type ExpiryClaim } from "@/features/push/courier-expiry";

const SECRET = "a-long-shared-secret-1234567890";

describe("isAuthorizedCronRequest", () => {
  it("accepts only the shared secret as a bearer token", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
  });
  it("refuses everything when the secret is missing or too short", () => {
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer short", "short")).toBe(false);
  });
});

describe("courierExpiryPushes", () => {
  const claim: ExpiryClaim = {
    event: "request_expired", reservation_id: "r1", buyer_id: "b1", seller_id: "s1",
    courier_name: "Lupita Recolectora", store_name: "Closet de Renata",
  };

  it("tells the buyer to choose again and the seller that she is choosing", () => {
    const pushes = courierExpiryPushes(claim);
    expect(pushes.map((push) => push.userId)).toEqual(["b1", "s1"]);
    expect(pushes[0]!.message).toMatchObject({ title: "Quien recolecta no respondió", url: "/cuenta#apartado-r1" });
    expect(pushes[0]!.message.body).toContain("Lupita Recolectora no contestó en 2 horas");
    expect(pushes[1]!.message.url).toBe("/panel/apartados");
  });

  it("tells both when the garments were released after the 12 hours", () => {
    const pushes = courierExpiryPushes({ ...claim, event: "released_without_delivery", courier_name: null });
    expect(pushes.map((push) => push.message.title)).toEqual(["Se liberaron tus prendas", "Prendas de vuelta a la venta"]);
    expect(pushes[0]!.message.body).toContain("Closet de Renata");
  });

  it("skips a buyer who deleted her account", () => {
    expect(courierExpiryPushes({ ...claim, buyer_id: null }).map((push) => push.userId)).toEqual(["s1"]);
  });
});
