import "server-only";

import { cache } from "react";
import type { ChatArea, ChatMessage, ConversationKind } from "@/features/chat/chat-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Conversations (20261125000100) as each area shows them. The database decides who is in a
// chat; `area` only picks which of her chats belong on this screen: a seller who also shops
// sees her buyer chats in /cuenta and her seller chats in /panel.

type MyConversationRow = {
  conversation_id: string; reservation_id: string; kind: ConversationKind; my_role: ChatArea;
  last_message_at: string | null; last_body: string | null; unread: number;
};

type ReservationInfo = {
  id: string; created_at: string; buyer_id: string | null;
  seller: { store_name: string } | null;
  courier: { full_name: string } | null;
  items: { product: { name: string } | null }[] | null;
};

export type ConversationSummary = {
  id: string; kind: ConversationKind; reservationId: string; title: string; subtitle: string;
  lastBody: string | null; lastMessageAt: string | null; unread: number;
};

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Monterrey" });

// One call per request: the menu badge, the header and the page all read it.
export const getMyConversations = cache(async (): Promise<MyConversationRow[]> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.rpc("my_conversations");
  return (data ?? []) as MyConversationRow[];
});

export async function unreadCount(area: ChatArea): Promise<number> {
  return (await getMyConversations()).filter((row) => row.my_role === area).reduce((sum, row) => sum + row.unread, 0);
}

// Unread messages per conversation and the conversation ids per reservation, for the links on
// the reservation cards.
export type ChatLinks = Partial<Record<ConversationKind, { id: string; unread: number }>>;

export async function conversationLinks(area: ChatArea): Promise<Map<string, ChatLinks>> {
  const links = new Map<string, ChatLinks>();
  for (const row of await getMyConversations()) {
    if (row.my_role !== area) continue;
    links.set(row.reservation_id, { ...links.get(row.reservation_id), [row.kind]: { id: row.conversation_id, unread: row.unread } });
  }
  return links;
}

async function reservationInfo(reservationIds: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || reservationIds.length === 0) return { reservations: new Map<string, ReservationInfo>(), buyers: new Map<string, string>() };
  const { data } = await supabase.from("reservations")
    .select("id,created_at,buyer_id,seller:profiles!reservations_seller_id_fkey(store_name),courier:couriers(full_name),items:reservation_items(product:products(name))")
    .in("id", reservationIds);
  const rows = (data ?? []) as unknown as ReservationInfo[];
  const buyerIds = [...new Set(rows.map((row) => row.buyer_id).filter((id): id is string => id !== null))];
  const { data: buyers } = buyerIds.length ? await supabase.from("buyer_profiles").select("id,full_name").in("id", buyerIds) : { data: [] };
  return {
    reservations: new Map(rows.map((row) => [row.id, row])),
    buyers: new Map((buyers ?? []).map((buyer) => [buyer.id, buyer.full_name as string])),
  };
}

// Who she is talking to, seen from her side. order: buyer-seller; pickup: seller-courier;
// delivery: buyer-courier (20261126000200).
function counterpart(area: ChatArea, kind: ConversationKind, reservation: ReservationInfo | undefined, buyers: Map<string, string>) {
  const buyer = (reservation?.buyer_id && buyers.get(reservation.buyer_id)) || (reservation?.buyer_id ? "Compradora" : "Cuenta borrada");
  const courier = `Recolectora ${reservation?.courier?.full_name ?? ""}`.trim();
  const store = reservation?.seller?.store_name ?? "Vendedora";
  if (area === "buyer") return kind === "delivery" ? courier : store;
  if (area === "courier") return kind === "delivery" ? buyer : store;
  return kind === "pickup" ? courier : buyer;
}

function subtitle(reservation: ReservationInfo | undefined) {
  if (!reservation) return "Apartado";
  const garments = (reservation.items ?? []).map((item) => item.product?.name ?? "Prenda").join(", ");
  return `Apartado del ${dateFormat.format(new Date(reservation.created_at))}${garments ? ` · ${garments}` : ""}`;
}

export async function listConversations(area: ChatArea): Promise<ConversationSummary[]> {
  const rows = (await getMyConversations()).filter((row) => row.my_role === area);
  const { reservations, buyers } = await reservationInfo([...new Set(rows.map((row) => row.reservation_id))]);
  return rows.map((row) => {
    const reservation = reservations.get(row.reservation_id);
    return {
      id: row.conversation_id, kind: row.kind, reservationId: row.reservation_id,
      title: counterpart(area, row.kind, reservation, buyers), subtitle: subtitle(reservation),
      lastBody: row.last_body, lastMessageAt: row.last_message_at, unread: row.unread,
    };
  });
}

export type LoadedConversation = {
  id: string; kind: ConversationKind; reservationId: string; title: string; subtitle: string;
  myId: string; messages: ChatMessage[]; names: Record<string, string>;
  // Short-lived signed URLs for the photos in `messages`, by storage path.
  photoUrls: Record<string, string>;
};

// One conversation for its area, or null when she is not in it from that side.
export async function loadConversation(conversationId: string, area: ChatArea): Promise<LoadedConversation | null> {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const mine = (await getMyConversations()).find((row) => row.conversation_id === conversationId && row.my_role === area);
  if (!mine) return null;

  const [{ data: latest }, { reservations, buyers }] = await Promise.all([
    supabase.from("messages").select("id,sender_id,body,created_at,image_path,image_purged_at").eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }).limit(200),
    reservationInfo([mine.reservation_id]),
  ]);
  const reservation = reservations.get(mine.reservation_id);
  const { data: sellerRow } = await supabase.from("reservations").select("seller_id,courier_id").eq("id", mine.reservation_id).maybeSingle();
  // Names by sender id: the other participants as she knows them, and "Tú" for herself.
  const names: Record<string, string> = { [user.id]: "Tú" };
  if (sellerRow?.seller_id && sellerRow.seller_id !== user.id) names[sellerRow.seller_id] = reservation?.seller?.store_name ?? "Vendedora";
  if (reservation?.buyer_id && reservation.buyer_id !== user.id) names[reservation.buyer_id] = buyers.get(reservation.buyer_id) ?? "Compradora";
  if (sellerRow?.courier_id && sellerRow.courier_id !== user.id) names[sellerRow.courier_id] = reservation?.courier?.full_name ?? "Recolectora";

  const messages = ((latest ?? []) as ChatMessage[]).toReversed();
  // Private bucket: photos are read through signed URLs, which row security lets only the
  // participants create (20261126000200).
  const paths = messages.map((message) => message.image_path).filter((path): path is string => Boolean(path));
  const { data: signed } = paths.length ? await supabase.storage.from("chat-photos").createSignedUrls(paths, 60 * 30) : { data: [] };
  const photoUrls = Object.fromEntries((signed ?? []).flatMap((entry) => (entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : [])));

  return {
    id: conversationId, kind: mine.kind, reservationId: mine.reservation_id,
    title: counterpart(area, mine.kind, reservation, buyers), subtitle: subtitle(reservation),
    myId: user.id, messages, names, photoUrls,
  };
}
