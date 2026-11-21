import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/chat/chat-thread";
import { loadConversation } from "@/features/chat/chat-data";
import { requireCourier } from "@/features/couriers/require-courier";

export const metadata = { title: "Mensajes | Closets Monterrey" };

export default async function CourierConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCourier(`/recolectora/mensajes/${id}`);
  const conversation = await loadConversation(id, "courier");
  if (!conversation) notFound();
  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">{conversation.title}</h1>
      <p className="mt-1 mb-4 text-sm text-stone-600">{conversation.subtitle} · <Link href="/recolectora" className="text-pine underline underline-offset-4">Mis entregas</Link></p>
      <ChatThread conversationId={conversation.id} area="courier" myId={conversation.myId} names={conversation.names} initialMessages={conversation.messages} placeholder="Escríbele a la vendedora" />
    </section>
  );
}
