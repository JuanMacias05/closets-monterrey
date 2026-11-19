import { notFound, redirect } from "next/navigation";
import { getSellerAvatarUrl } from "@/features/products/public-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StoreSettingsForm } from "@/app/panel/tienda/store-settings-form";
import { DeliverySettings } from "@/app/panel/tienda/delivery-settings";

export default async function StoreSettingsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("store_name,avatar_path,role,status,deposit_percent")
      .eq("id", authData.user.id)
      .maybeSingle(),
    supabase
      .from("seller_private_settings")
      .select("whatsapp_e164,clabe")
      .eq("seller_id", authData.user.id)
      .maybeSingle(),
  ]);

  if (profileError || settingsError) throw new Error("No pudimos cargar los datos de tu tienda.");
  if (!profile || !settings) notFound();

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-8 border-b border-stone-200 pb-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Tu tienda</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900">Edita tu tienda</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Tu nombre y tu foto salen en tu tienda y en cada prenda. El WhatsApp y la CLABE no son públicos: solo los ve quien te aparta una prenda (y la recolectora, tu WhatsApp, si lleva el pedido).</p>
      </div>
      <StoreSettingsForm
        sellerId={authData.user.id}
        storeName={profile.store_name}
        avatarPath={profile.avatar_path}
        avatarUrl={getSellerAvatarUrl(supabase, profile.avatar_path)}
        whatsapp={settings.whatsapp_e164 ?? ""}
        clabe={settings.clabe ?? ""}
        depositPercent={profile.deposit_percent}
      />
      <div className="mt-10"><DeliverySettings sellerId={authData.user.id} /></div>
    </section>
  );
}
