import Link from "next/link";
import { conversationHref, messageTimeLabel, unreadLabel } from "@/features/chat/chat-format";
import type { ConversationSummary } from "@/features/chat/chat-data";

// Her inbox: every chat, newest first, labelled ("Como clienta", "Como vendedora", "Entrega"),
// with unread counts.
export function ConversationList({ conversations, empty }: { conversations: ConversationSummary[]; empty: string }) {
  if (conversations.length === 0) return <p className="mt-6 border-y border-stone-200 py-8 text-center text-sm text-stone-600">{empty}</p>;
  return (
    <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
      {conversations.map((conversation) => {
        const unread = unreadLabel(conversation.unread);
        return (
          <li key={conversation.id}>
            <Link href={conversationHref(conversation.id)} className="flex items-start gap-3 py-4 hover:bg-stone-50">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`text-stone-900 ${conversation.unread > 0 ? "font-semibold" : "font-medium"}`}>{conversation.title}</span>
                    <span className={`px-1.5 py-0.5 font-condensed text-xs font-bold uppercase ${conversation.roleLabel === "Entrega" ? "bg-[#e6eee9] text-pine" : conversation.roleLabel === "Como vendedora" ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-700"}`}>{conversation.roleLabel}</span>
                  </span>
                  {conversation.lastMessageAt && <span className="text-xs text-stone-500">{messageTimeLabel(conversation.lastMessageAt)}</span>}
                </span>
                <span className="block truncate text-xs text-stone-500">{conversation.subtitle}</span>
                <span className="mt-1 block truncate text-sm text-stone-700">{conversation.lastBody ?? "Sin mensajes todavía"}</span>
              </span>
              {unread && (
                <span className="mt-1 grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-[#a3261b] px-1.5 text-xs font-semibold text-white">
                  <span aria-hidden="true">{conversation.unread}</span><span className="sr-only">{unread}</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// A link to one chat from a reservation card: the main way to talk (WhatsApp stays secondary).
export function ChatLink({ href, label, unread }: { href: string; label: string; unread: number }) {
  const text = unreadLabel(unread);
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2 border-2 border-pine px-4 font-condensed text-sm font-bold uppercase text-pine hover:bg-[#e6eee9]">
      {label}
      {text && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#a3261b] px-1 font-sans text-[11px] font-semibold text-white"><span aria-hidden="true">{unread}</span><span className="sr-only"> ({text})</span></span>}
    </Link>
  );
}
