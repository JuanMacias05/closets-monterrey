"use server";

import { revalidatePath } from "next/cache";
import { chatBasePath, cleanMessageBody, isChatPhotoPathFor, messagePreview, type ChatArea, type ChatMessage } from "@/features/chat/chat-format";
import { notifyNewMessage } from "@/features/push/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

// Inserted under her own session: row security checks she is in the conversation, writes as
// herself, the chat is still open and, with a photo, that she uploaded it to this same chat
// (20261125000100, 20261126000200). The others get a push afterwards.
export async function sendChatMessage(conversationId: string, body: string, imagePath: string | null = null): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }> {
  if (!UUID.test(conversationId)) return { ok: false, error: "Conversación no válida." };
  if (imagePath !== null && !isChatPhotoPathFor(conversationId, imagePath)) return { ok: false, error: "No encontramos la foto que subiste. Inténtalo de nuevo." };
  const hasText = typeof body === "string" && body.trim().length > 0;
  const text = hasText ? cleanMessageBody(body) : null;
  if (hasText && !text) return { ok: false, error: "Escribe un mensaje de hasta 1,000 caracteres." };
  if (!text && !imagePath) return { ok: false, error: "Escribe un mensaje o adjunta una foto." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión para continuar." };

  const { data, error } = await supabase.from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text, image_path: imagePath })
    .select("id,sender_id,body,created_at,image_path,image_purged_at").single();
  if (error || !data) return { ok: false, error: "No pudimos enviar tu mensaje. Si el apartado cerró hace más de 30 días, la conversación ya no recibe mensajes." };
  notifyNewMessage(conversationId, user.id, messagePreview(text, imagePath !== null));
  return { ok: true, message: data as ChatMessage };
}

// Opening a chat clears its unread count; the area's layout (menu badge) is refreshed with it.
export async function markConversationRead(conversationId: string, area: ChatArea): Promise<{ ok: boolean }> {
  if (!UUID.test(conversationId) || !["buyer", "seller", "courier"].includes(area)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase.rpc("mark_conversation_read", { target: conversationId });
  if (error) return { ok: false };
  revalidatePath(area === "buyer" ? "/" : chatBasePath(area).replace(/\/mensajes$/, ""), "layout");
  return { ok: true };
}
