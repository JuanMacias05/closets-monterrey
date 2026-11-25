import { CourierFeeForm } from "@/app/recolectora/courier-fee-form";
import { CourierCard } from "@/components/couriers/courier-card";
import { getCourierDirectory } from "@/features/couriers/directory";
import { requireCourier } from "@/features/couriers/require-courier";

export const metadata = { title: "Mi perfil | BZRS Monterrey" };

const STATUS_LABELS: Record<string, string> = { pending: "En revisión", approved: "✓ Identidad verificada", suspended: "Cuenta suspendida" };

// How buyers see her. Her name is not editable here: it is the name the administration checked
// against her ID in person, and the "Verificada" badge vouches for it.
export default async function CourierProfilePage() {
  const { viewer, supabase } = await requireCourier("/recolectora/perfil");
  const [{ data: courier }, { data: privateRow }, directory] = await Promise.all([
    supabase.from("couriers").select("full_name,status,fee_mxn").eq("id", viewer.userId).single(),
    supabase.from("courier_private").select("phone_e164").eq("courier_id", viewer.userId).maybeSingle(),
    getCourierDirectory(),
  ]);
  const card = directory.find((entry) => entry.id === viewer.userId);

  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Mi perfil</h1>
      <dl className="mt-6 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-stone-600">Nombre</dt><dd className="text-stone-900">{courier?.full_name}</dd>
        <dt className="text-stone-600">Estado</dt>
        <dd><span className={`px-2 py-0.5 font-condensed text-sm font-bold uppercase ${courier?.status === "approved" ? "bg-pine text-white" : "bg-stone-100 text-stone-800"}`}>{STATUS_LABELS[courier?.status ?? ""] ?? courier?.status}</span></dd>
        <dt className="text-stone-600">Celular</dt><dd className="text-stone-900">{privateRow?.phone_e164 ?? "—"} <span className="text-stone-600">· solo lo ven la tienda y tu cliente de una entrega que aceptaste</span></dd>
      </dl>
      <p className="mt-2 text-xs text-stone-600">Para cambiar tu nombre, escribe a la administración: es el que verificaron con tu identificación.</p>

      <div className="mt-8 border-t border-stone-200 pt-6">
        <h2 className="font-condensed text-xl font-bold uppercase text-stone-900">Tu tarifa</h2>
        <p className="mt-1 mb-4 text-sm text-stone-600">Una tarifa fija por entrega. La clientela la ve al elegir recolección.</p>
        <CourierFeeForm feeMxn={courier?.fee_mxn ?? 0} />
      </div>

      <div className="mt-8 border-t border-stone-200 pt-6">
        <h2 className="font-condensed text-xl font-bold uppercase text-stone-900">Así te ve la clientela</h2>
        {card ? (
          <div className="mt-4 max-w-md"><CourierCard courier={card} /></div>
        ) : (
          <p className="mt-2 text-sm text-stone-600">Apareces en el directorio de recolección cuando la administración te verifica.</p>
        )}
      </div>
    </section>
  );
}
