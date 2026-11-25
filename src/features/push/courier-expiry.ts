import { createHash, timingSafeEqual } from "node:crypto";
import type { PushMessage } from "@/features/push/push-config";

// The 5-minute ping from the database (20261126000300) and what it turns into. Pure, for tests.

export type ExpiryClaim = {
  event: "request_expired" | "released_without_delivery";
  reservation_id: string;
  buyer_id: string | null;
  seller_id: string;
  courier_name: string | null;
  store_name: string | null;
};

// The ping carries "Authorization: Bearer <secret>", the secret stored in Vault
// (courier_expiry_webhook_secret) and in the app's CRON_WEBHOOK_SECRET. Compared in constant
// time over fixed-length digests, so neither the length nor the content leaks through timing.
export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !authorization?.startsWith("Bearer ")) return false;
  const given = createHash("sha256").update(authorization.slice("Bearer ".length)).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}

// Who hears about each claimed event, and what they read. The seller hears too: her panel
// already tells her the buyer is choosing again, and a release puts garments back on sale.
export function courierExpiryPushes(claim: ExpiryClaim): { userId: string; message: PushMessage }[] {
  const courier = claim.courier_name ?? "Quien recolecta";
  const store = claim.store_name ?? "la tienda";
  const tag = `apartado-${claim.reservation_id}`;
  const pushes: { userId: string; message: PushMessage }[] = [];
  if (claim.event === "request_expired") {
    if (claim.buyer_id) {
      pushes.push({ userId: claim.buyer_id, message: { title: "Quien recolecta no respondió", body: `${courier} no contestó en 2 horas. Pide a alguien más o cambia de entrega; tienes 12 horas.`, url: `/cuenta#apartado-${claim.reservation_id}`, tag } });
    }
    pushes.push({ userId: claim.seller_id, message: { title: "Quien recolecta no respondió", body: `${courier} no contestó a tiempo. Tu cliente está eligiendo otra entrega.`, url: "/panel/apartados", tag } });
  } else {
    if (claim.buyer_id) {
      pushes.push({ userId: claim.buyer_id, message: { title: "Se liberaron tus prendas", body: `No elegiste otra entrega a tiempo para tu apartado de ${store}.`, url: `/cuenta#apartado-${claim.reservation_id}`, tag } });
    }
    pushes.push({ userId: claim.seller_id, message: { title: "Prendas de vuelta a la venta", body: "Tu cliente no eligió otra entrega a tiempo; el apartado se liberó.", url: "/panel/apartados", tag } });
  }
  return pushes;
}
