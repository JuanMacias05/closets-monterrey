import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreHeader } from "@/components/store/store-header";
import { BuyerProfileForm } from "@/components/shop/buyer-profile-form";
import { RemoveFromCartButton } from "@/components/shop/remove-from-cart-button";
import { ReserveButton } from "@/components/shop/reserve-button";
import { formatPriceMXN } from "@/features/products/format-price";
import { getProductImageUrl } from "@/features/products/public-images";
import { getSellerDeliveryOptions } from "@/features/shop/seller-delivery-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Carrito | Closets Monterrey" };

type CartRow = {
  product: {
    id: string; slug: string; name: string; price_mxn: number; sale_status: string; seller_id: string;
    seller: { id: string; store_name: string; deposit_percent: number; home_delivery_enabled: boolean; home_delivery_origin: string | null; home_delivery_note: string | null } | null;
    images: { source: "local_placeholder" | "storage"; storage_path: string; alt_text: string; position: number }[] | null;
  } | null;
};

// The cart is grouped by seller because each seller is reserved and paid separately: the
// deposit goes to her own CLABE at her own percentage.
export default async function CartPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/carrito");

  await supabase.rpc("release_expired_reservations");
  const [{ data: rows }, { data: buyer }] = await Promise.all([
    supabase.from("cart_items")
      .select("product:products(id,slug,name,price_mxn,sale_status,seller_id,seller:profiles!products_seller_id_fkey(id,store_name,deposit_percent,home_delivery_enabled,home_delivery_origin,home_delivery_note),images:product_images(source,storage_path,alt_text,position))")
      .order("created_at", { ascending: true }),
    supabase.from("buyer_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  const items = ((rows ?? []) as unknown as CartRow[]).flatMap((row) => (row.product && row.product.seller ? [row.product] : []));
  const sellerIds = [...new Set(items.map((item) => item.seller_id))];
  const { data: accepting } = sellerIds.length
    ? await supabase.rpc("sellers_accepting_reservations", { seller_ids: sellerIds })
    : { data: [] as string[] };
  const acceptingSet = new Set((accepting ?? []) as string[]);
  const deliveryOptions = await getSellerDeliveryOptions(sellerIds.map((sellerId) => items.find((item) => item.seller_id === sellerId)!.seller!));

  const groups = sellerIds.map((sellerId) => {
    const groupItems = items.filter((item) => item.seller_id === sellerId);
    const seller = groupItems[0]!.seller!;
    const available = groupItems.filter((item) => item.sale_status === "available");
    const total = available.reduce((sum, item) => sum + item.price_mxn, 0);
    return { seller, items: groupItems, availableCount: available.length, unavailableCount: groupItems.length - available.length, total, accepting: acceptingSet.has(sellerId) };
  });

  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-16 pt-8 sm:px-8">
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900 sm:text-5xl">Carrito</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">Tener una prenda aquí no la aparta. Se aparta en tres pasos: tus prendas, cómo las recibes y el anticipo. Tienes 24 horas para transferir el anticipo a la vendedora (si pides recolectora, desde que ella acepta) y el resto se paga en la entrega.</p>

        {groups.length === 0 ? (
          <div className="mt-10 border-y border-stone-200 py-16 text-center">
            <p className="font-serif text-2xl text-stone-800">Tu carrito está vacío.</p>
            <Link href="/" className="mt-6 inline-flex min-h-11 items-center border-b-2 border-pine font-condensed text-base font-bold uppercase text-pine">Ver prendas</Link>
          </div>
        ) : (
          <>
            {!buyer && (
              <section className="mt-8 border border-amber-700 bg-amber-50 p-5">
                <h2 className="font-condensed text-lg font-bold uppercase text-stone-900">Antes de apartar</h2>
                <p className="mt-1 mb-4 text-sm text-stone-700">Las vendedoras necesitan saber quién aparta. Completa tu nombre y tu perfil de Facebook.</p>
                <BuyerProfileForm submitLabel="Guardar mis datos" />
              </section>
            )}

            {groups.map((group) => (
              <section key={group.seller.id} className="mt-10 border-t-2 border-pine pt-5" aria-labelledby={`seller-${group.seller.id}`}>
                <h2 id={`seller-${group.seller.id}`} className="font-condensed text-xl font-bold uppercase text-stone-900">{group.seller.store_name}</h2>
                <ul className="mt-4 divide-y divide-stone-200">
                  {group.items.map((item) => {
                    const image = (item.images ?? []).toSorted((a, b) => a.position - b.position)[0];
                    const unavailable = item.sale_status !== "available";
                    return (
                      <li key={item.id} className="flex items-center gap-4 py-4">
                        <Link href={`/prendas/${item.slug}`} className="relative block size-20 shrink-0 bg-stone-100">
                          {image && <Image src={getProductImageUrl(supabase, image)} alt={image.alt_text || item.name} fill sizes="80px" className={`object-cover ${unavailable ? "opacity-50" : ""}`} />}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={`/prendas/${item.slug}`} className="block truncate text-stone-900 hover:underline">{item.name}</Link>
                          <p className="text-sm text-stone-900">{formatPriceMXN(item.price_mxn)}</p>
                          {unavailable && <p className="text-sm font-medium text-[#a3261b]">Ya no está disponible{item.sale_status === "reserved" ? ": alguien la apartó" : ""}</p>}
                        </div>
                        <RemoveFromCartButton productId={item.id} productName={item.name} />
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex flex-col gap-4 bg-stone-100 p-4">
                  <ReserveButton
                    options={deliveryOptions.get(group.seller.id) ?? { points: [], homeDelivery: null, couriers: [] }}
                    sellerId={group.seller.id}
                    storeName={group.seller.store_name}
                    itemsTotalMxn={group.total}
                    itemCount={group.availableCount}
                    depositPercent={group.seller.deposit_percent}
                    disabled={!buyer || !group.accepting || group.availableCount === 0 || group.unavailableCount > 0}
                  />
                </div>
                {!group.accepting && <p className="mt-2 text-sm text-stone-600">Esta vendedora todavía no registra su CLABE, así que aún no se puede apartar.</p>}
                {group.accepting && group.unavailableCount > 0 && <p className="mt-2 text-sm text-stone-600">Quita las prendas que ya no están disponibles para poder apartar.</p>}
              </section>
            ))}
          </>
        )}
      </main>
    </>
  );
}
