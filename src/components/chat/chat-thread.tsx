"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { ChatPhoto } from "@/components/chat/chat-photo";
import { markConversationRead, sendChatMessage } from "@/features/chat/actions";
import { chatPhotoPath, MAX_MESSAGE_LENGTH, mergeMessages, messageTimeLabel, type ChatMessage } from "@/features/chat/chat-format";
import { prepareProductImage } from "@/features/products/product-image-upload";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// One conversation, live. New messages arrive through Supabase Realtime (row security decides
// what this browser may receive); if the live feed can't connect, the page refreshes itself
// every 20 seconds instead, so the chat still works, just slower.
//
// Photos: the browser shrinks a picked photo to a JPEG of at most 300 KB (the same helper as
// garment and proof photos), uploads it straight to the private chat-photos bucket and then
// sends the message pointing at it (20261126000200).
export function ChatThread({ conversationId, myId, names, initialMessages, photoUrls, placeholder }: {
  conversationId: string;
  myId: string;
  names: Record<string, string>;
  initialMessages: ChatMessage[];
  photoUrls: Record<string, string>;
  placeholder: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  // What arrived after the page loaded (sent here or received live). The page's own list is the
  // base; a refresh (fallback polling, or after marking read) brings a newer one.
  const [arrived, setArrived] = useState<ChatMessage[]>([]);
  const messages = useMemo(() => mergeMessages(initialMessages, arrived), [initialMessages, arrived]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const bottomRef = useRef<HTMLLIElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.previewUrl); }, [photo]);

  function pickPhoto(file: File | null) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Elige una foto (imagen).");
      return;
    }
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  function clearPhoto() {
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Shrinks and uploads the picked photo; returns its storage path.
  async function uploadPhoto(file: File): Promise<string> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase no está configurado.");
    const prepared = await prepareProductImage(file);
    const path = chatPhotoPath(conversationId, crypto.randomUUID());
    const { error: uploadError } = await supabase.storage.from("chat-photos").upload(path, prepared.file, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw new Error("No pudimos subir la foto. Si el apartado cerró hace más de 30 días, la conversación ya no recibe fotos.");
    return path;
  }

  // Opening the chat reads it; the refresh updates the unread badge in the menu or header.
  useEffect(() => {
    markConversationRead(conversationId).then((result) => {
      if (result.ok) router.refresh();
    });
  }, [conversationId, router]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      // The live feed applies row security with her token; set it before subscribing.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`chat:${conversationId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
          const message = payload.new as ChatMessage;
          setArrived((current) => [...current, message]);
          if (message.sender_id !== myId) markConversationRead(conversationId);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setLive(true);
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setLive(false);
        });
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, myId]);

  useEffect(() => {
    if (live) return;
    const timer = window.setInterval(() => router.refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [live, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [messages.length, reduceMotion]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    if ((!draft.trim() && !photo) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const imagePath = photo ? await uploadPhoto(photo.file) : null;
      const result = await sendChatMessage(conversationId, draft, imagePath);
      if (result.ok) {
        setArrived((current) => [...current, result.message]);
        setDraft("");
        clearPhoto();
      } else {
        setError(result.error);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos enviar la foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col border border-stone-200 bg-white">
      <ol aria-label="Mensajes" aria-live="polite" className="flex max-h-[60vh] min-h-64 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && <li className="m-auto max-w-sm text-center text-sm text-stone-500">Todavía no hay mensajes. Escribe el primero.</li>}
        {messages.map((message) => {
          const mine = message.sender_id === myId;
          return (
            <li key={message.id} className={`flex max-w-[85%] flex-col ${mine ? "self-end items-end" : "self-start items-start"}`}>
              <span className="text-[11px] text-stone-500">{mine ? "Tú" : (message.sender_id && names[message.sender_id]) || "Cuenta borrada"} · {messageTimeLabel(message.created_at)}</span>
              {message.image_path && <ChatPhoto path={message.image_path} initialUrl={photoUrls[message.image_path] ?? null} senderLabel={mine ? "Tu foto" : `Foto de ${(message.sender_id && names[message.sender_id]) || "Cuenta borrada"}`} />}
              {!message.image_path && message.image_purged_at && <p className="mt-0.5 border border-dashed border-stone-300 px-3 py-2 text-xs italic text-stone-500">Foto eliminada por privacidad</p>}
              {message.body && <p className={`mt-0.5 whitespace-pre-wrap break-words px-3 py-2 text-sm ${mine ? "bg-pine text-white" : "bg-stone-100 text-stone-900"}`}>{message.body}</p>}
            </li>
          );
        })}
        <li ref={bottomRef} aria-hidden="true" />
      </ol>
      {photo && (
        <div className="flex items-center gap-3 border-t border-stone-200 px-3 pt-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview (object URL) before upload */}
          <img src={photo.previewUrl} alt="Foto por enviar" className="size-16 border border-stone-200 object-cover" />
          <button type="button" onClick={clearPhoto} disabled={busy} className="min-h-11 text-sm text-stone-700 underline underline-offset-4">Quitar foto</button>
        </div>
      )}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-stone-200 p-3">
        {/* Without `capture`, phones offer both the camera and the gallery. */}
        <input ref={fileRef} id={`chat-photo-${conversationId}`} type="file" accept="image/*" className="sr-only" onChange={(event) => pickPhoto(event.target.files?.[0] ?? null)} />
        <label htmlFor={`chat-photo-${conversationId}`} title="Adjuntar foto" className="press grid min-h-11 min-w-11 cursor-pointer place-items-center border border-stone-300 text-stone-700 hover:border-stone-600">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          <span className="sr-only">Adjuntar foto</span>
        </label>
        <label htmlFor={`chat-${conversationId}`} className="sr-only">Escribe un mensaje</label>
        <textarea
          id={`chat-${conversationId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter writes a new line (phones); Ctrl/⌘ + Enter sends from a keyboard.
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
          }}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={2}
          placeholder={placeholder}
          className="min-h-11 flex-1 resize-y border border-stone-300 p-2 text-sm"
        />
        <button type="submit" disabled={busy || (!draft.trim() && !photo)} className="press min-h-11 bg-pine px-4 font-condensed text-sm font-bold uppercase text-white disabled:opacity-50">
          {busy ? "Enviando…" : "Enviar"}
        </button>
      </form>
      {!live && <p className="px-3 pb-2 text-xs text-stone-500">Sin conexión en vivo: los mensajes nuevos se cargan cada 20 segundos.</p>}
      {error && <p role="alert" className="px-3 pb-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
