import { formatPriceMXN } from "@/features/products/format-price";
import { deliveryGroup, type DeliveryGroupInput } from "@/features/shop/reservation-money";

export function whatsappLink(phoneE164: string, text?: string) {
  const base = `https://wa.me/${phoneE164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export type ReservationNotice = DeliveryGroupInput & {
  buyerName: string | null;
  storeName: string | null;
  depositMxn: number;
  items: { name: string; priceMxn: number }[];
};

// The seller gets no automatic notice when someone reserves from her, and the buyer's 24-hour
// clock is already running. This message is how she finds out, so it carries everything she
// needs to match the payment that follows: who, which garments, how much and where.
export function reservationNoticeMessage(notice: ReservationNotice) {
  const greeting = notice.storeName ? `Hola, ${notice.storeName}` : "Hola";
  const who = notice.buyerName ? `, soy ${notice.buyerName}` : "";
  const items = notice.items.map((item) => `• ${item.name} (${formatPriceMXN(item.priceMxn)})`);
  return [
    `${greeting}${who}. Te aparté en Closets Monterrey:`,
    ...items,
    `Anticipo: ${formatPriceMXN(notice.depositMxn)}. Entrega: ${deliveryGroup(notice).label}.`,
    "Te subo el comprobante en Closets Monterrey para que lo revises.",
  ].join("\n");
}
