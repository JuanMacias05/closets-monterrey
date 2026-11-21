"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { markConversationRead, sendChatMessage } from "@/features/chat/actions";
import { MAX_MESSAGE_LENGTH, mergeMessages, messageTimeLabel, type ChatArea, type ChatMessage } from "@/features/chat/chat-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// One conversation, live. New messages arrive through Supabase Realtime (row security decides
// what this browser may receive); if the live feed can't connect, the page refreshes itself
// every 20 seconds instead, so the chat still works, just slower.
export function ChatThread({ conversationId, area, myId, names, initialMessages, placeholder }: {
  conversationId: string;
  area: ChatArea;
  myId: string;
  names: Record<string, string>;
  initialMessages: ChatMessage[];
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
  const bottomRef = useRef<HTMLLIElement>(null);

  // Opening the chat reads it; the refresh updates the unread badge in the menu or header.
  useEffect(() => {
    markConversationRead(conversationId, area).then((result) => {
      if (result.ok) router.refresh();
    });
  }, [conversationId, area, router]);

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
          if (message.sender_id !== myId) markConversationRead(conversationId, area);
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
  }, [conversationId, area, myId]);

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
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await sendChatMessage(conversationId, draft);
    if (result.ok) {
      setArrived((current) => [...current, result.message]);
      setDraft("");
    } else {
      setError(result.error);
    }
    setBusy(false);
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
              <p className={`mt-0.5 whitespace-pre-wrap break-words px-3 py-2 text-sm ${mine ? "bg-pine text-white" : "bg-stone-100 text-stone-900"}`}>{message.body}</p>
            </li>
          );
        })}
        <li ref={bottomRef} aria-hidden="true" />
      </ol>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-stone-200 p-3">
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
        <button type="submit" disabled={busy || !draft.trim()} className="press min-h-11 bg-pine px-4 font-condensed text-sm font-bold uppercase text-white disabled:opacity-50">
          {busy ? "Enviando…" : "Enviar"}
        </button>
      </form>
      {!live && <p className="px-3 pb-2 text-xs text-stone-500">Sin conexión en vivo: los mensajes nuevos se cargan cada 20 segundos.</p>}
      {error && <p role="alert" className="px-3 pb-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
