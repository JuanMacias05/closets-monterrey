import { redirect } from "next/navigation";
import { AccountActions } from "@/app/panel/admin/vendedoras/account-actions";
import { ActivitiesEditor } from "@/components/accounts/activities-editor";
import { AddPersonForm } from "@/components/accounts/add-person-form";
import { arrivalLabel } from "@/features/accounts/people";
import { isAdminUser } from "@/features/viewer/is-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const statusLabels: Record<string, string> = { pending: "En revisión", approved: "Bazar aprobado", suspended: "Cuenta suspendida" };
const statusStyles: Record<string, string> = {
  pending: "border border-amber-700 text-amber-800",
  approved: "bg-pine text-white",
  suspended: "border border-[#a3261b] text-[#a3261b]",
};

export const metadata = { title: "Bazares | BZRS Monterrey" };

export default async function AdminAccountsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await isAdminUser(supabase, user.id))) redirect("/panel");

  // Admins read every profile, courier, admin flag and private settings row through RLS
  // (is_admin()), so the phone comes along without a service-role key.
  const [{ data: rows, error }, { data: admins }, { data: couriers }] = await Promise.all([
    supabase.from("profiles")
      .select("id,store_name,status,created_at,added_by,settings:seller_private_settings(phone_e164)")
      .order("created_at", { ascending: false }),
    supabase.from("admins").select("user_id"),
    supabase.from("couriers").select("id,status"),
  ]);
  if (error) throw new Error("No pudimos cargar las cuentas.");
  const adminIds = new Set((admins ?? []).map((row) => row.user_id));
  const courierStatus = new Map((couriers ?? []).map((row) => [row.id, row.status as string]));

  const accounts = (rows ?? []).map((row) => {
    const settings = Array.isArray(row.settings) ? row.settings[0] : row.settings;
    return { ...row, phone: settings?.phone_e164 ?? null };
  });
  // Pending accounts are the ones waiting on a decision, so they go first.
  const sorted = accounts.toSorted((left, right) => Number(right.status === "pending") - Number(left.status === "pending"));
  const pendingCount = accounts.filter((account) => account.status === "pending").length;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-5">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">Bazares</h1>
          <p className="mt-2 text-sm text-stone-600">
            {pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? "cuenta espera" : "cuentas esperan"} aprobación.` : "No hay cuentas pendientes."} Aprueba a quien pide vender, o agrega tú a alguien.
          </p>
        </div>
        <AddPersonForm defaultActivity="sell" />
      </div>

      <ul className="divide-y divide-stone-200">
        {sorted.map((account) => {
          const courier = courierStatus.get(account.id);
          const isAdmin = adminIds.has(account.id);
          return (
            <li key={account.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-900">{account.store_name}</span>
                  <span className={`px-2 py-0.5 font-condensed text-xs font-bold uppercase ${statusStyles[account.status] ?? ""}`}>{statusLabels[account.status] ?? account.status}</span>
                  {isAdmin && <span className="bg-stone-900 px-2 py-0.5 font-condensed text-xs font-bold uppercase text-white">Admin</span>}
                  {courier && courier !== "suspended" && <span className="border border-stone-400 px-2 py-0.5 font-condensed text-xs font-bold uppercase text-stone-700">También entrega</span>}
                  {account.id === user.id && <span className="text-xs text-stone-500">(tú)</span>}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {account.phone ?? "Sin celular"} · desde {new Date(account.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · {arrivalLabel(account.added_by)}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <AccountActions accountId={account.id} storeName={account.store_name} status={account.status} isSelf={account.id === user.id} />
                <ActivitiesEditor
                  personId={account.id}
                  name={account.store_name}
                  sell={account.status !== "suspended"}
                  deliver={courier !== undefined && courier !== "suspended"}
                  administer={isAdmin}
                  isSelf={account.id === user.id}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
