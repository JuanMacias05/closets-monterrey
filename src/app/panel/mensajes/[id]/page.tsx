import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/chat/chat-thread";
import { loadConversation } from "@/features/chat/chat-data";

export const metadata = { title: "Mensajes | Closets Monterrey" };

export default async function SellerConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await loadConversation(id, "seller");
  if (!conversation) notFound();
  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">{conversation.title}</h1>
      <p className="mt-1 mb-4 text-sm text-stone-600">{conversation.subtitle} · <Link href="/panel/apartados" className="text-pine underline underline-offset-4">Ver apartados</Link></p>
      <ChatThread conversationId={conversation.id} area="seller" myId={conversation.myId} names={conversation.names} initialMessages={conversation.messages} placeholder={conversation.kind === "pickup" ? "Escríbele a la recolectora" : "Escríbele a la clienta"} />
    </section>
  );
}
