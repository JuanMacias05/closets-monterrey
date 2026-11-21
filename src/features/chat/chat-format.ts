// Chat helpers shared by the server pages and the live thread. Pure, for tests.

export type ChatArea = "buyer" | "seller" | "courier";

export type ConversationKind = "order" | "pickup" | "delivery";

// body is null for a photo sent without text; image_path is null once the nightly purge removed
// the photo (image_purged_at then says when), 30 days after the reservation closed.
export type ChatMessage = {
  id: string; sender_id: string | null; body: string | null; created_at: string;
  image_path?: string | null; image_purged_at?: string | null;
};

// What a notification or a list shows for a message (20261126000200: "📷 Foto" without text).
export function messagePreview(body: string | null | undefined, hasPhoto: boolean): string {
  const text = body?.trim();
  if (text) return text;
  return hasPhoto ? "📷 Foto" : "";
}

// Chat photos live at <conversation id>/<uuid>.jpg in the private chat-photos bucket; the
// storage policies and the messages policy check that shape (20261126000200).
export function chatPhotoPath(conversationId: string, photoId: string): string {
  return `${conversationId}/${photoId}.jpg`;
}

export function isChatPhotoPathFor(conversationId: string, path: unknown): path is string {
  return typeof path === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(path) && path.startsWith(`${conversationId}/`);
}

export const MAX_MESSAGE_LENGTH = 1000;

// Each area has its own chat pages so they live inside that area's frame (store header,
// seller panel, courier panel).
export function chatBasePath(area: ChatArea): string {
  return area === "buyer" ? "/cuenta/mensajes" : area === "seller" ? "/panel/mensajes" : "/recolectora/mensajes";
}

// Same rule as the messages table's check: 1 to 1,000 characters once trimmed.
export function cleanMessageBody(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  return text.length >= 1 && text.length <= MAX_MESSAGE_LENGTH ? text : null;
}

// Messages arrive twice when she sends one (the action's answer and the live feed), and the
// live feed can arrive out of order: keep one copy of each, oldest first.
export function mergeMessages(current: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of [...current, ...incoming]) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id.localeCompare(b.id)));
}

const timeFormat = new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: "America/Monterrey" });
const dayFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Monterrey" });

// "18:05" today, "19 nov 18:05" before.
export function messageTimeLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const sameDay = dayFormat.format(date) === dayFormat.format(now);
  return sameDay ? timeFormat.format(date) : `${dayFormat.format(date)} ${timeFormat.format(date)}`;
}

export function unreadLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 mensaje sin leer" : `${count} mensajes sin leer`;
}
