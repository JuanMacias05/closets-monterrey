import { ConversationList } from "@/components/chat/conversation-list";
import { listConversations } from "@/features/chat/chat-data";
import { requireCourier } from "@/features/couriers/require-courier";

export const metadata = { title: "Mensajes | Closets Monterrey" };

export default async function CourierMessagesPage() {
  await requireCourier("/recolectora/mensajes");
  const conversations = await listConversations("courier");
  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Mensajes</h1>
      <p className="mt-2 text-sm text-stone-600">Con la vendedora de cada entrega que aceptaste, para coordinar la recolección.</p>
      <ConversationList area="courier" conversations={conversations} empty="Cuando aceptes una entrega, aquí platicas con la vendedora." />
    </section>
  );
}
