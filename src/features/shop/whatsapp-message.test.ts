import { describe, expect, it } from "vitest";
import { reservationNoticeMessage, whatsappLink } from "@/features/shop/whatsapp-message";

describe("whatsappLink", () => {
  it("drops the plus sign and encodes the prefilled text", () => {
    expect(whatsappLink("+528112345678")).toBe("https://wa.me/528112345678");
    expect(whatsappLink("+528112345678", "Hola & adiós")).toBe("https://wa.me/528112345678?text=Hola%20%26%20adi%C3%B3s");
  });
});

describe("reservationNoticeMessage", () => {
  it("lists who, what, the deposit and the hand-off", () => {
    const message = reservationNoticeMessage({
      buyerName: "Ana", storeName: "Closet de Renata", depositMxn: 8400,
      items: [{ name: "Jeans rectos", priceMxn: 42000 }],
      delivery_method: "pickup_point", point: { name: "Estación Padre Mier" }, courier: null,
    });
    expect(message).toContain("Hola, Closet de Renata, soy Ana. Te aparté en BZRS Monterrey:");
    expect(message).toContain("• Jeans rectos ($420.00 MXN)");
    expect(message).toContain("Anticipo: $84.00 MXN. Entrega: Estación Padre Mier.");
  });

  it("still reads naturally without names", () => {
    const message = reservationNoticeMessage({
      buyerName: null, storeName: null, depositMxn: 1000, items: [],
      delivery_method: "arranged", point: null, courier: null,
    });
    expect(message.startsWith("Hola. Te aparté")).toBe(true);
    expect(message).toContain("Entrega: Acordar por WhatsApp.");
  });
});
