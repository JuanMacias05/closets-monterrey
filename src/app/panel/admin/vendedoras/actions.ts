"use server";

import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/features/viewer/is-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

// Approve or suspend a store. The database already enforces who may do this (only admins can
// change status — see private.guard_profile_changes), so this action is about clear errors and
// one rule the database doesn't know: an admin can't suspend her own store from here. Admin
// itself is granted in "Actividades" (admin_set_activities, 20261127000100).
export async function updateAccount(accountId: string, change: { status: "approved" | "suspended" }): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Inicia sesión para administrar cuentas." };
  if (!(await isAdminUser(supabase, user.id))) return { ok: false, error: "Solo la administración puede cambiar cuentas." };

  if (!/^[0-9a-f-]{36}$/i.test(accountId) || !change || !["approved", "suspended"].includes(change.status)) {
    return { ok: false, error: "Los datos del cambio no son válidos." };
  }
  if (accountId === user.id && change.status === "suspended") {
    return { ok: false, error: "No puedes suspender tu propia tienda." };
  }

  const { data: updated, error } = await supabase.from("profiles")
    .update({ status: change.status }).eq("id", accountId).select("id").maybeSingle();
  if (error || !updated) return { ok: false, error: "No pudimos guardar el cambio de la cuenta." };

  revalidatePath("/panel/admin/vendedoras");
  // A newly approved or suspended seller's products appear in or vanish from the storefront.
  revalidatePath("/");
  return { ok: true };
}
