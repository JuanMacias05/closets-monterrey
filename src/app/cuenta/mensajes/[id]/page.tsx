import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatThread } from "@/components/chat/chat-thread";
import { StoreHeader } from "@/components/store/store-header";
import { loadConversation } from "@/features/chat/chat-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Mensajes | Closets Monterrey" };

export default async function BuyerConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/cuenta/mensajes/${id}`);
  const conversation = await loadConversation(id, "buyer");
  if (!conversation) notFound();
  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-16 pt-6 sm:px-8">
        <Link href="/cuenta/mensajes" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-stone-700 underline-offset-4 hover:underline"><span aria-hidden="true">←</span> Mensajes</Link>
        <h1 className="font-condensed text-2xl font-bold uppercase text-stone-900">{conversation.title}</h1>
        <p className="mb-4 text-sm text-stone-600">{conversation.subtitle} · <Link href={`/cuenta#apartado-${conversation.reservationId}`} className="text-pine underline underline-offset-4">Ver apartado</Link></p>
        <ChatThread conversationId={conversation.id} area="buyer" myId={conversation.myId} names={conversation.names} initialMessages={conversation.messages} placeholder="Escríbele a la vendedora" />
      </main>
    </>
  );
}
