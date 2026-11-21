import { ConversationList } from "@/components/chat/conversation-list";
import { listConversations } from "@/features/chat/chat-data";

export const metadata = { title: "Mensajes | Closets Monterrey" };

// The panel layout already checked she is an approved seller.
export default async function SellerMessagesPage() {
  const conversations = await listConversations("seller");
  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Mensajes</h1>
      <p className="mt-2 text-sm text-stone-600">Con cada clienta que te aparta, y con la recolectora cuando lleva un pedido.</p>
      <ConversationList area="seller" conversations={conversations} empty="Cuando te aparten una prenda, aquí platicas con la clienta." />
    </section>
  );
}
