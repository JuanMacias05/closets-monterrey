import Link from "next/link";
import { redirect } from "next/navigation";
import { TrustOverrideSelect } from "@/app/panel/admin/clientas/trust-override-select";
import { TRUST_LABELS, TRUST_STYLES } from "@/features/shop/reservation-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Clientas | Closets Monterrey" };

export default async function AdminBuyersPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
  if (admin?.role !== "admin" || admin.status !== "approved") redirect("/panel");

  const { data: buyers, error } = await supabase.from("buyer_profiles")
    .select("id,full_name,facebook_url,phone_e164,trust_override,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("No pudimos cargar las clientas.");
  const lights = new Map(await Promise.all((buyers ?? []).map(async (buyer) =>
    [buyer.id, (await supabase.rpc("buyer_trust_light", { target: buyer.id })).data as string | null] as const)));

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-5">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">Clientas</h1>
          <p className="mt-2 max-w-xl text-sm text-stone-600">El semáforo es automático: verde con compras cumplidas, amarillo si dejó vencer un apartado, rojo si una vendedora reportó que le quedó mal. Puedes fijarlo a mano.</p>
        </div>
        <Link href="/panel" className="flex min-h-11 items-center text-sm text-stone-700 underline underline-offset-4">Volver al panel</Link>
      </div>
      {(buyers ?? []).length === 0 ? (
        <p className="py-6 text-sm text-stone-600">Aún no hay clientas registradas.</p>
      ) : (
        <ul className="divide-y divide-stone-200">
          {(buyers ?? []).map((buyer) => {
            const light = lights.get(buyer.id) ?? "new";
            return (
              <li key={buyer.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-900">{buyer.full_name}</span>
                    <span className={`px-2 py-0.5 font-condensed text-xs font-bold uppercase ${TRUST_STYLES[light] ?? ""}`}>{TRUST_LABELS[light] ?? light}</span>
                    {buyer.trust_override && <span className="text-xs text-stone-500">(fijado a mano)</span>}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
                    <a href={buyer.facebook_url} target="_blank" rel="noopener noreferrer" className="text-pine underline underline-offset-4">Facebook</a>
                    {buyer.phone_e164 && <span className="text-stone-600">{buyer.phone_e164}</span>}
                  </p>
                </div>
                <TrustOverrideSelect buyerId={buyer.id} buyerName={buyer.full_name} value={buyer.trust_override} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
