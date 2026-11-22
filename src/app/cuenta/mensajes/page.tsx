import Link from "next/link";
import { redirect } from "next/navigation";
import { ConversationList } from "@/components/chat/conversation-list";
import { StoreHeader } from "@/components/store/store-header";
import { listConversations } from "@/features/chat/chat-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Mensajes | Closets Monterrey" };

export default async function BuyerMessagesPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta/mensajes");
  const conversations = await listConversations();
  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-16 pt-6 sm:px-8">
        <Link href="/cuenta" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-stone-700 underline-offset-4 hover:underline"><span aria-hidden="true">←</span> Mi cuenta</Link>
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900">Mensajes</h1>
        <p className="mt-2 text-sm text-stone-600">Todos tus chats en un lugar: como clienta, como vendedora y de cada entrega.</p>
        <ConversationList conversations={conversations} empty="Cuando apartes prendas (o te aparten, o lleves un pedido), aquí platicas." />
      </main>
    </>
  );
}
