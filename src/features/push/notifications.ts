import "server-only";

import { after } from "next/server";
import { pushToUsers } from "@/features/push/send-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// The events that send a push. Each runs after the response (after()), once the action that
// caused it already succeeded under the user's own session; the lookups here only find who to
// tell. Expired courier requests send nothing: they expire lazily, with no moment to send from.

type ReservationPeople = {
  id: string; buyer_id: string | null; seller_id: string; courier_id: string | null;
  seller: { store_name: string } | null;
};

async function reservationPeople(reservationId: string): Promise<{ admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>; reservation: ReservationPeople } | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("reservations")
    .select("id,buyer_id,seller_id,courier_id,seller:profiles!reservations_seller_id_fkey(store_name)")
    .eq("id", reservationId).maybeSingle();
  return data ? { admin, reservation: data as unknown as ReservationPeople } : null;
}

async function buyerName(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, buyerId: string | null) {
  if (!buyerId) return "Una clienta";
  const { data } = await admin.from("buyer_profiles").select("full_name").eq("id", buyerId).maybeSingle();
  return data?.full_name ?? "Una clienta";
}

async function courierName(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, courierId: string | null) {
  if (!courierId) return "La recolectora";
  const { data } = await admin.from("couriers").select("full_name").eq("id", courierId).maybeSingle();
  return data?.full_name ?? "La recolectora";
}

// A new apartado: the seller hears about it (before, the buyer had to message her on WhatsApp).
// With a courier, the courier gets her request too.
export function notifyNewReservation(reservationId: string, withCourier: boolean) {
  after(async () => {
    const found = await reservationPeople(reservationId);
    if (!found) return;
    const { admin, reservation } = found;
    await pushToUsers([reservation.seller_id], {
      title: "Nuevo apartado",
      body: `${await buyerName(admin, reservation.buyer_id)} apartó prendas de tu clóset.`,
      url: "/panel/apartados",
      tag: `apartado-${reservation.id}`,
    });
    if (withCourier) await notifyCourierRequestNow(found);
  });
}

// The buyer asked a (new) courier from /cuenta.
export function notifyCourierRequested(reservationId: string) {
  after(async () => {
    const found = await reservationPeople(reservationId);
    if (found) await notifyCourierRequestNow(found);
  });
}

async function notifyCourierRequestNow({ reservation }: { reservation: ReservationPeople }) {
  if (!reservation.courier_id) return;
  await pushToUsers([reservation.courier_id], {
    title: "Nueva solicitud de entrega",
    body: `${reservation.seller?.store_name ?? "Una vendedora"}: tienes 2 horas para aceptarla o rechazarla.`,
    url: "/recolectora/solicitudes",
    tag: `solicitud-${reservation.id}`,
  });
}

// The courier answered. Accepted: the buyer can pay and the seller knows who collects. Rejected:
// the buyer must choose again.
export function notifyCourierAnswer(requestId: string, accepted: boolean) {
  after(async () => {
    const admin = createSupabaseAdminClient();
    if (!admin) return;
    const { data: request } = await admin.from("courier_requests").select("reservation_id,courier_id").eq("id", requestId).maybeSingle();
    if (!request) return;
    const found = await reservationPeople(request.reservation_id);
    if (!found) return;
    const name = await courierName(admin, request.courier_id);
    const { reservation } = found;
    if (accepted) {
      await pushToUsers([reservation.buyer_id], {
        title: `${name} aceptó tu entrega`,
        body: "Ya puedes pagar tu anticipo: tienes 24 horas.",
        url: `/cuenta#apartado-${reservation.id}`,
        tag: `apartado-${reservation.id}`,
      });
      await pushToUsers([reservation.seller_id], {
        title: `${name} llevará un pedido`,
        body: "Aceptó recoger un apartado de tu clóset. Coordínense en Mensajes.",
        url: "/panel/apartados",
        tag: `apartado-${reservation.id}`,
      });
    } else {
      await pushToUsers([reservation.buyer_id], {
        title: "Tu recolectora no aceptó",
        body: `${name} no puede llevar tu pedido. Elige otra entrega en tu cuenta.`,
        url: `/cuenta#apartado-${reservation.id}`,
        tag: `apartado-${reservation.id}`,
      });
    }
  });
}

// A chat message: everyone else in the conversation, linked to the chat in her own area.
export function notifyNewMessage(conversationId: string, senderId: string, body: string) {
  after(async () => {
    const admin = createSupabaseAdminClient();
    if (!admin) return;
    const { data: conversation } = await admin.from("conversations").select("id,kind,reservation_id").eq("id", conversationId).maybeSingle();
    if (!conversation) return;
    const found = await reservationPeople(conversation.reservation_id);
    if (!found) return;
    const { reservation } = found;
    const store = reservation.seller?.store_name ?? "La vendedora";
    const preview = body.length > 120 ? `${body.slice(0, 119)}…` : body;
    const tag = `chat-${conversation.id}`;
    if (conversation.kind === "order") {
      if (senderId === reservation.seller_id) {
        await pushToUsers([reservation.buyer_id], { title: store, body: preview, url: `/cuenta/mensajes/${conversation.id}`, tag });
      } else {
        await pushToUsers([reservation.seller_id], { title: await buyerName(admin, reservation.buyer_id), body: preview, url: `/panel/mensajes/${conversation.id}`, tag });
      }
    } else if (senderId === reservation.seller_id) {
      await pushToUsers([reservation.courier_id], { title: store, body: preview, url: `/recolectora/mensajes/${conversation.id}`, tag });
    } else {
      await pushToUsers([reservation.seller_id], { title: await courierName(admin, reservation.courier_id), body: preview, url: `/panel/mensajes/${conversation.id}`, tag });
    }
  });
}
