import Link from "next/link";
import { CourierDeliveryActions } from "@/app/recolectora/delivery-actions";
import { ChatLink } from "@/components/chat/conversation-list";
import { conversationLinks, type ChatLinks } from "@/features/chat/chat-data";
import { requireCourier } from "@/features/couriers/require-courier";
import { formatPriceMXN } from "@/features/products/format-price";

export const metadata = { title: "Mis entregas | Closets Monterrey" };

type Assignment = {
  id: string; status: string; buyer_id: string | null; delivery_status: string; delivery_address: string | null; buyer_municipality: string | null;
  delivery_fee_mxn: number; courier_fee_payment: string | null; seller_whatsapp: string | null; expires_at: string;
  seller: { store_name: string } | null;
  items: { product: { name: string } | null }[] | null;
};

const STEP_LABELS: Record<string, string> = { preparing: "Por recoger", picked_up: "Contigo", on_the_way: "En camino" };
const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Monterrey" });

// Deliveries she accepted. Row security only lets her read a reservation once she accepted it
// (20261124000100), so everything here is hers to deliver. Two groups: confirmed (go collect)
// and accepted but still waiting for the buyer's deposit (coming up).
export default async function CourierDeliveriesPage() {
  const { viewer, supabase } = await requireCourier("/recolectora");

  const [{ data: rows }, { count: waitingRequests }] = await Promise.all([
    supabase.from("reservations")
      .select("id,status,buyer_id,delivery_status,delivery_address,buyer_municipality,delivery_fee_mxn,courier_fee_payment,seller_whatsapp,expires_at,seller:profiles!reservations_seller_id_fkey(store_name),items:reservation_items(product:products(name))")
      .eq("courier_id", viewer.userId).in("status", ["pending_deposit", "confirmed"])
      .order("created_at", { ascending: true }),
    supabase.from("courier_requests").select("id", { count: "exact", head: true }).eq("courier_id", viewer.userId).eq("status", "requested"),
  ]);
  const assignments = (rows ?? []) as unknown as Assignment[];
  const toDeliver = assignments.filter((assignment) => assignment.status === "confirmed");
  const upcoming = assignments.filter((assignment) => assignment.status === "pending_deposit");
  const buyerIds = [...new Set(assignments.map((a) => a.buyer_id).filter((id): id is string => id !== null))];
  const { data: buyers } = buyerIds.length
    ? await supabase.from("buyer_profiles").select("id,full_name,phone_e164").in("id", buyerIds)
    : { data: [] };
  const buyerById = new Map((buyers ?? []).map((buyer) => [buyer.id, buyer]));
  const chats = await conversationLinks("courier");

  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Mis entregas</h1>
      {/* On a phone the menu's count hides behind the menu button; requests expire in 2 hours. */}
      {(waitingRequests ?? 0) > 0 && (
        <p role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-pine bg-[#e6eee9] p-4 text-sm text-stone-900">
          <span><strong>{waitingRequests === 1 ? "Tienes 1 solicitud por responder." : `Tienes ${waitingRequests} solicitudes por responder.`}</strong> Se vencen en 2 horas.</span>
          <Link href="/recolectora/solicitudes" className="inline-flex min-h-11 items-center bg-pine px-4 font-condensed text-sm font-bold uppercase text-white">Ver solicitudes</Link>
        </p>
      )}

      <h2 className="mt-8 font-condensed text-2xl font-bold uppercase text-stone-900">Por entregar</h2>
      {toDeliver.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">No tienes entregas por ahora. Te aparecen aquí cuando la vendedora confirma el anticipo de un pedido que aceptaste.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {toDeliver.map((assignment) => {
            const buyer = assignment.buyer_id ? buyerById.get(assignment.buyer_id) : undefined;
            return (
              <li key={assignment.id} className="border border-stone-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-stone-900">Para {buyer?.full_name ?? "la clienta"} · {assignment.buyer_municipality}</p>
                  <span className="bg-stone-100 px-2 py-1 font-condensed text-sm font-bold uppercase text-stone-800">{STEP_LABELS[assignment.delivery_status] ?? assignment.delivery_status}</span>
                </div>
                <p className="mt-2 text-sm text-stone-700"><strong>Recoges con:</strong> {assignment.seller?.store_name ?? "la vendedora"}{assignment.seller_whatsapp && <> · <a href={`https://wa.me/${assignment.seller_whatsapp.replace("+", "")}`} className="text-pine underline underline-offset-4">WhatsApp</a></>}</p>
                <p className="text-sm text-stone-700"><strong>Entregas en:</strong> {assignment.delivery_address}{buyer?.phone_e164 && <> · <a href={`https://wa.me/${buyer.phone_e164.replace("+", "")}`} className="text-pine underline underline-offset-4">WhatsApp de la clienta</a></>}</p>
                <p className="text-sm text-stone-700"><strong>Prendas:</strong> {(assignment.items ?? []).map((item) => item.product?.name ?? "Prenda").join(", ")}</p>
                <p className="text-sm text-stone-700"><strong>Tu tarifa:</strong> {formatPriceMXN(assignment.delivery_fee_mxn)} · {assignment.courier_fee_payment === "with_deposit" ? "te la paga la vendedora" : "te la paga la clienta al recibir"}</p>
                <CourierChatLinks links={chats.get(assignment.id)} />
                <div className="mt-4"><CourierDeliveryActions reservationId={assignment.id} deliveryStatus={assignment.delivery_status} buyerName={buyer?.full_name ?? "La clienta"} /></div>
              </li>
            );
          })}
        </ul>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="mt-10 font-condensed text-2xl font-bold uppercase text-stone-900">Aceptadas · esperando anticipo</h2>
          <p className="mt-1 text-sm text-stone-600">La clienta ya puede pagar. Cuando la vendedora confirme su anticipo, pasan a Por entregar.</p>
          <ul className="mt-4 space-y-3">
            {upcoming.map((assignment) => {
              const buyer = assignment.buyer_id ? buyerById.get(assignment.buyer_id) : undefined;
              return (
                <li key={assignment.id} className="border border-stone-200 bg-white p-4 text-sm text-stone-700">
                  <p className="font-medium text-stone-900">{assignment.seller?.store_name ?? "Vendedora"} → {buyer?.full_name ?? "la clienta"}, {assignment.buyer_municipality}</p>
                  <p>{(assignment.items ?? []).map((item) => item.product?.name ?? "Prenda").join(", ")} · tu tarifa {formatPriceMXN(assignment.delivery_fee_mxn)}</p>
                  <p className="text-stone-600">Tiene hasta {dateFormat.format(new Date(assignment.expires_at))} para pagar; si no, el pedido se libera.</p>
                  <CourierChatLinks links={chats.get(assignment.id)} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

// Her two chats for one delivery: with the seller (to collect) and with the buyer (to deliver).
function CourierChatLinks({ links }: { links: ChatLinks | undefined }) {
  if (!links?.pickup && !links?.delivery) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.pickup && <ChatLink href={`/cuenta/mensajes/${links.pickup.id}`} label="Mensajes con la vendedora" unread={links.pickup.unread} />}
      {links.delivery && <ChatLink href={`/cuenta/mensajes/${links.delivery.id}`} label="Mensajes con la clienta" unread={links.delivery.unread} />}
    </div>
  );
}
