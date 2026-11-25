import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatThread } from "@/components/chat/chat-thread";
import { StoreHeader } from "@/components/store/store-header";
import { loadConversation, type LoadedConversation } from "@/features/chat/chat-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Mensajes | BZRS Monterrey" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/cuenta/mensajes/${id}`);
  const conversation = await loadConversation(id);
  if (!conversation) notFound();
  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-16 pt-6 sm:px-8">
        <Link href="/cuenta/mensajes" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-stone-700 underline-offset-4 hover:underline"><span aria-hidden="true">←</span> Mensajes</Link>
        <h1 className="flex flex-wrap items-center gap-3 font-condensed text-2xl font-bold uppercase text-stone-900">
          {conversation.title}
          <span className="bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">{conversation.roleLabel}</span>
        </h1>
        <p className="mb-4 text-sm text-stone-600">{conversation.subtitle} · <Link href={reservationHref(conversation)} className="text-pine underline underline-offset-4">Ver apartado</Link></p>
        <ChatThread conversationId={conversation.id} myId={conversation.myId} names={conversation.names} initialMessages={conversation.messages} photoUrls={conversation.photoUrls} placeholder={placeholder(conversation)} />
      </main>
    </>
  );
}

// Where the order behind the chat lives, from her side.
function reservationHref(conversation: LoadedConversation) {
  if (conversation.myRole === "seller") return "/panel/apartados";
  if (conversation.myRole === "courier") return "/recolectora";
  return `/cuenta#apartado-${conversation.reservationId}`;
}

function placeholder(conversation: LoadedConversation) {
  if (conversation.kind === "order") return conversation.myRole === "seller" ? "Escríbele a tu cliente" : "Escríbele a la tienda";
  if (conversation.kind === "pickup") return conversation.myRole === "seller" ? "Escríbele a quien recolecta" : "Escríbele a la tienda";
  return conversation.myRole === "courier" ? "Escríbele a tu cliente" : "Escríbele a quien recolecta";
}
