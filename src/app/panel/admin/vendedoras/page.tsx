import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountActions } from "@/app/panel/admin/vendedoras/account-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const statusLabels: Record<string, string> = { pending: "En revisión", approved: "Aprobada", suspended: "Suspendida" };
const statusStyles: Record<string, string> = {
  pending: "border border-amber-700 text-amber-800",
  approved: "bg-pine text-white",
  suspended: "border border-[#a3261b] text-[#a3261b]",
};

export const metadata = { title: "Vendedoras | Closets Monterrey" };

export default async function AdminAccountsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: admin } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
  if (admin?.role !== "admin" || admin.status !== "approved") redirect("/panel");

  // Admins can read every profile and every private settings row through RLS (is_admin()),
  // so the phone comes along without a service-role key.
  const { data: rows, error } = await supabase.from("profiles")
    .select("id,store_name,role,status,created_at,settings:seller_private_settings(phone_e164)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("No pudimos cargar las cuentas.");

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
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">Vendedoras</h1>
          <p className="mt-2 text-sm text-stone-600">
            {pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? "cuenta espera" : "cuentas esperan"} aprobación.` : "No hay cuentas pendientes."}
          </p>
        </div>
        <Link href="/panel" className="flex min-h-11 items-center text-sm text-stone-700 underline underline-offset-4">Volver al panel</Link>
      </div>

      <ul className="divide-y divide-stone-200">
        {sorted.map((account) => (
          <li key={account.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-stone-900">{account.store_name}</span>
                <span className={`px-2 py-0.5 font-condensed text-xs font-bold uppercase ${statusStyles[account.status] ?? ""}`}>{statusLabels[account.status] ?? account.status}</span>
                {account.role === "admin" && <span className="bg-stone-900 px-2 py-0.5 font-condensed text-xs font-bold uppercase text-white">Admin</span>}
                {account.id === user.id && <span className="text-xs text-stone-500">(tú)</span>}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {account.phone ?? "Sin celular"} · desde {new Date(account.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <AccountActions accountId={account.id} storeName={account.store_name} role={account.role} status={account.status} isSelf={account.id === user.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
