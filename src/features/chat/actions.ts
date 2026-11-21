"use server";

import { revalidatePath } from "next/cache";
import { chatBasePath, cleanMessageBody, type ChatArea, type ChatMessage } from "@/features/chat/chat-format";
import { notifyNewMessage } from "@/features/push/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

// Inserted under her own session: row security checks she is in the conversation, writes as
// herself and the chat is still open (20261125000100). The others get a push afterwards.
export async function sendChatMessage(conversationId: string, body: string): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }> {
  const text = cleanMessageBody(body);
  if (!UUID.test(conversationId)) return { ok: false, error: "Conversación no válida." };
  if (!text) return { ok: false, error: "Escribe un mensaje de hasta 1,000 caracteres." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión para continuar." };

  const { data, error } = await supabase.from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
    .select("id,sender_id,body,created_at").single();
  if (error || !data) return { ok: false, error: "No pudimos enviar tu mensaje. Si el apartado cerró hace más de 30 días, la conversación ya no recibe mensajes." };
  notifyNewMessage(conversationId, user.id, text);
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
