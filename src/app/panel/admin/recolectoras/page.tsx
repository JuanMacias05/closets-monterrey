import { redirect } from "next/navigation";
import { CourierStatusActions } from "@/app/panel/admin/recolectoras/courier-status-actions";
import { ActivitiesEditor } from "@/components/accounts/activities-editor";
import { AddPersonForm } from "@/components/accounts/add-person-form";
import { arrivalLabel } from "@/features/accounts/people";
import { formatPriceMXN } from "@/features/products/format-price";
import { isAdminUser } from "@/features/viewer/is-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Recolección | BZRS Monterrey" };

const statusLabels: Record<string, string> = { pending: "En revisión", approved: "Identidad verificada", suspended: "Cuenta suspendida" };

export default async function AdminCouriersPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isAdminUser(supabase, user.id))) redirect("/panel");

  const [{ data: couriers }, { data: phones }, { data: admins }, { data: stores }] = await Promise.all([
    supabase.from("couriers").select("id,full_name,status,municipalities,fee_mxn,created_at,added_by").order("created_at", { ascending: false }),
    supabase.from("courier_private").select("courier_id,phone_e164"),
    supabase.from("admins").select("user_id"),
    supabase.from("profiles").select("id,status"),
  ]);
  const phoneById = new Map((phones ?? []).map((row) => [row.courier_id, row.phone_e164]));
  const adminIds = new Set((admins ?? []).map((row) => row.user_id));
  const storeStatus = new Map((stores ?? []).map((row) => [row.id, row.status as string]));
  const sorted = (couriers ?? []).toSorted((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-5">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">Verificar quién entrega</h1>
          <p className="mt-2 max-w-xl text-sm text-stone-600">Verifica a cada persona revisando su INE y comprobante de domicilio <strong>en persona</strong>, o agrega tú a alguien que ya revisaste. No subas identificaciones a la app.</p>
        </div>
        <AddPersonForm defaultActivity="deliver" />
      </div>
      {sorted.length === 0 ? <p className="py-6 text-sm text-stone-600">Aún nadie se registró para entregar.</p> : (
        <ul className="divide-y divide-stone-200">
          {sorted.map((courier) => (
            <li key={courier.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-900">{courier.full_name}</span>
                  <span className={`px-2 py-0.5 font-condensed text-xs font-bold uppercase ${courier.status === "approved" ? "bg-pine text-white" : courier.status === "pending" ? "border border-amber-700 text-amber-800" : "border border-[#a3261b] text-[#a3261b]"}`}>{statusLabels[courier.status] ?? courier.status}</span>
                </p>
                <p className="mt-1 text-sm text-stone-600">{phoneById.get(courier.id) ?? "Sin celular"} · {(courier.municipalities ?? []).join(", ") || "sin municipios"} · {formatPriceMXN(courier.fee_mxn)} · {arrivalLabel(courier.added_by)}</p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <CourierStatusActions courierId={courier.id} name={courier.full_name} status={courier.status} />
                <ActivitiesEditor
                  personId={courier.id}
                  name={courier.full_name}
                  sell={storeStatus.has(courier.id) && storeStatus.get(courier.id) !== "suspended"}
                  deliver={courier.status !== "suspended"}
                  administer={adminIds.has(courier.id)}
                  isSelf={courier.id === user.id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
