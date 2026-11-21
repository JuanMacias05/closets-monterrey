// What the seller still collects in person, and how her reservations group by hand-off.

export type ReservationMoney = {
  items_total_mxn: number;
  deposit_mxn: number;
  delivery_method: string;
  delivery_fee_mxn: number;
  courier_fee_payment: string | null;
};

// IMPORTANT: deposit_mxn is not only the garments' share. When the buyer pays a courier
// "with_deposit", the courier's fee rides inside it (create_reservation adds it), and the
// seller passes it on; it is not money toward the garments. A courier fee paid "on_delivery"
// goes straight to the courier. A home-delivery fee is the seller's, collected at the door;
// delivery_fee_mxn already holds her adjustment if she made one.
export function sellerBalanceAtDelivery(reservation: ReservationMoney) {
  const courierFeeInDeposit = reservation.delivery_method === "courier" && reservation.courier_fee_payment === "with_deposit"
    ? reservation.delivery_fee_mxn
    : 0;
  const garmentsDeposit = reservation.deposit_mxn - courierFeeInDeposit;
  const homeFee = reservation.delivery_method === "home_delivery" ? reservation.delivery_fee_mxn : 0;
  return Math.max(0, reservation.items_total_mxn - garmentsDeposit) + homeFee;
}

// Same rounding as reserve_cart_from_seller: the garments' share, up to whole pesos.
export function depositForGarments(itemsTotalMxn: number, depositPercent: number) {
  return Math.ceil((itemsTotalMxn * depositPercent) / 100 / 100) * 100;
}

export type CheckoutQuoteInput = {
  itemsTotalMxn: number;
  depositPercent: number;
  deliveryMethod: string;
  // null while the buyer hasn't picked what prices it (her municipality, a courier).
  deliveryFeeMxn: number | null;
  courierFeePayment: string | null;
};

// What the cart shows before "Apartar", by the reservation function's rules: only a courier
// fee paid "with_deposit" changes the deposit; a home-delivery fee is paid at the door.
export function checkoutQuote(input: CheckoutQuoteInput) {
  const fee = input.deliveryFeeMxn ?? 0;
  const feeInDeposit = input.deliveryMethod === "courier" && input.courierFeePayment === "with_deposit" ? fee : 0;
  const depositMxn = depositForGarments(input.itemsTotalMxn, input.depositPercent) + feeInDeposit;
  const totalMxn = input.itemsTotalMxn + fee;
  return { depositMxn, totalMxn, dueAtDeliveryMxn: Math.max(0, totalMxn - depositMxn) };
}

export type DeliveryFeeInput = {
  delivery_method: string;
  delivery_fee_mxn: number;
  delivery_fee_estimate_mxn: number | null;
  delivery_fee_adjusted_at: string | null;
};

// "La vendedora ajustó el envío de $90 a $120": only when she changed it and it no longer
// matches what the buyer saw at checkout (setting it back to the estimate is no news).
export function deliveryFeeChange(reservation: DeliveryFeeInput): { fromMxn: number; toMxn: number } | null {
  if (reservation.delivery_method !== "home_delivery" || !reservation.delivery_fee_adjusted_at) return null;
  if (reservation.delivery_fee_estimate_mxn === null || reservation.delivery_fee_estimate_mxn === reservation.delivery_fee_mxn) return null;
  return { fromMxn: reservation.delivery_fee_estimate_mxn, toMxn: reservation.delivery_fee_mxn };
}

export type DeliveryGroupInput = { delivery_method: string; point: { name: string } | null; courier: { full_name: string } | null };

// One key per hand-off the seller has to plan for: each fixed point, each courier, home
// delivery, and "arranged by WhatsApp". Used as the ?entrega= filter on /panel/apartados.
export function deliveryGroup(reservation: DeliveryGroupInput): { key: string; label: string } {
  if (reservation.delivery_method === "pickup_point") {
    const name = reservation.point?.name ?? "Punto fijo";
    return { key: `punto:${name}`, label: name };
  }
  if (reservation.delivery_method === "courier") {
    const name = reservation.courier?.full_name ?? "Recolectora";
    return { key: `recolectora:${name}`, label: `Recolectora ${name}` };
  }
  if (reservation.delivery_method === "home_delivery") return { key: "domicilio", label: "A domicilio" };
  return { key: "acordar", label: "Acordar por WhatsApp" };
}
