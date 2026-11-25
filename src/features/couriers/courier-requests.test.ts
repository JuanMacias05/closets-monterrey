import { describe, expect, it } from "vitest";
import {
  buyerCourierNotice,
  canPayDeposit,
  courierDeliveryState,
  courierRequestsLeft,
  declinedCourierIds,
  latestCourierRequest,
  timeLeftLabel,
  type CourierRequestRow,
} from "@/features/couriers/courier-requests";

function request(overrides: Partial<CourierRequestRow>): CourierRequestRow {
  return {
    id: "q1", status: "requested", requested_at: "2026-11-20T10:00:00Z", expires_at: "2026-11-20T12:00:00Z",
    resolved_at: null, rejection_reason: null, courier_id: "c1", courier: { full_name: "Lupita" }, ...overrides,
  };
}

const courierReservation = { delivery_method: "courier", courier_id: "c1", courier_accepted_at: null };

describe("courierDeliveryState", () => {
  it("is none for other delivery methods", () => {
    expect(courierDeliveryState({ delivery_method: "pickup_point", courier_id: null, courier_accepted_at: null }, [])).toEqual({ kind: "none" });
  });

  it("waits while the courier is on the reservation without accepting", () => {
    const waiting = request({});
    expect(courierDeliveryState(courierReservation, [waiting])).toEqual({ kind: "waiting", request: waiting });
  });

  it("is accepted once the reservation records it", () => {
    const accepted = request({ status: "accepted", resolved_at: "2026-11-20T10:30:00Z" });
    expect(courierDeliveryState({ ...courierReservation, courier_accepted_at: "2026-11-20T10:30:00Z" }, [accepted]).kind).toBe("accepted");
  });

  it("needs a new choice after a no, with the latest request for who and why", () => {
    const first = request({ id: "q1", status: "expired", requested_at: "2026-11-20T08:00:00Z" });
    const second = request({ id: "q2", status: "rejected", rejection_reason: "Muy lejos", requested_at: "2026-11-20T10:00:00Z" });
    expect(courierDeliveryState({ ...courierReservation, courier_id: null }, [second, first])).toEqual({ kind: "needs_choice", request: second });
  });
});

describe("canPayDeposit", () => {
  it("blocks paying only for a courier delivery without a yes", () => {
    expect(canPayDeposit(courierReservation)).toBe(false);
    expect(canPayDeposit({ ...courierReservation, courier_accepted_at: "2026-11-20T10:30:00Z" })).toBe(true);
    expect(canPayDeposit({ delivery_method: "home_delivery", courier_id: null, courier_accepted_at: null })).toBe(true);
  });
});

describe("who can be asked again", () => {
  const requests = [
    request({ id: "q1", status: "rejected", courier_id: "c1" }),
    request({ id: "q2", status: "expired", courier_id: "c2" }),
  ];

  it("leaves out only couriers who said no", () => {
    expect(declinedCourierIds(requests)).toEqual(["c1"]);
  });

  it("counts down the 3 requests a reservation may send", () => {
    expect(courierRequestsLeft(requests)).toBe(1);
    expect(courierRequestsLeft([...requests, request({ id: "q3" }), request({ id: "q4" })])).toBe(0);
  });

  it("finds the latest request by when it was sent", () => {
    expect(latestCourierRequest([request({ id: "a", requested_at: "2026-11-20T09:00:00Z" }), request({ id: "b", requested_at: "2026-11-20T11:00:00Z" })])?.id).toBe("b");
    expect(latestCourierRequest([])).toBeNull();
  });
});

describe("timeLeftLabel", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  it("says hours and minutes until the deadline", () => {
    expect(timeLeftLabel("2026-11-20T11:20:00Z", now)).toBe("1 h 20 min");
    expect(timeLeftLabel("2026-11-20T12:00:00Z", now)).toBe("2 h");
    expect(timeLeftLabel("2026-11-20T10:45:30Z", now)).toBe("45 min");
    expect(timeLeftLabel("2026-11-20T10:00:30Z", now)).toBe("menos de 1 min");
  });
  it("is null once the deadline passed", () => {
    expect(timeLeftLabel("2026-11-20T09:59:00Z", now)).toBeNull();
  });
});

describe("buyerCourierNotice", () => {
  it("tells her not to pay while waiting", () => {
    const notice = buyerCourierNotice({ kind: "waiting", request: request({}) }, "20 nov 12:00");
    expect(notice?.title).toBe("Esperando a que Lupita acepte");
    expect(notice?.body).toContain("Todavía no pagues nada");
  });
  it("opens payment once she accepts", () => {
    expect(buyerCourierNotice({ kind: "accepted", request: request({ status: "accepted" }) }, "21 nov 10:30")?.body).toBe("Ya puedes pagar tu anticipo. Tienes hasta 21 nov 10:30.");
  });
  it("quotes the courier's reason after a no", () => {
    const notice = buyerCourierNotice({ kind: "needs_choice", request: request({ status: "rejected", rejection_reason: "Muy lejos" }) }, "20 nov 22:00");
    expect(notice?.title).toBe("Quien recolecta no aceptó");
    expect(notice?.body).toContain("Lupita no puede llevar tu pedido: “Muy lejos”.");
  });
  it("says when she simply didn't answer", () => {
    expect(buyerCourierNotice({ kind: "needs_choice", request: request({ status: "expired" }) }, "x")?.body).toContain("Lupita no respondió a tiempo.");
  });
  it("is nothing for other deliveries", () => {
    expect(buyerCourierNotice({ kind: "none" }, "x")).toBeNull();
  });
});
