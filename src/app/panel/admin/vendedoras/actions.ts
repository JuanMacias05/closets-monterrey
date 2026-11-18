"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };
type AccountChange = { status: "approved" | "suspended" } | { role: "admin" | "seller" };

// Approve, suspend, promote or demote an account. The database already enforces who may do
// this (only admins can change role/status — see private.guard_profile_changes), so this action
// is about clear errors and one rule the database doesn't know: an admin can't suspend or
// demote themselves. That keeps the store from ever ending up with nobody able to manage it.
export async function updateAccount(accountId: string, change: AccountChange): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Inicia sesión para administrar cuentas." };

  const { data: admin, error: adminError } = await supabase.from("profiles")
    .select("role,status").eq("id", user.id).maybeSingle();
  if (adminError || admin?.role !== "admin" || admin.status !== "approved") {
    return { ok: false, error: "Solo la administración puede cambiar cuentas." };
  }

  const validChange = change && (
    ("status" in change && ["approved", "suspended"].includes(change.status))
    || ("role" in change && ["admin", "seller"].includes(change.role))
  );
  if (!/^[0-9a-f-]{36}$/i.test(accountId) || !validChange) {
    return { ok: false, error: "Los datos del cambio no son válidos." };
  }
  if (accountId === user.id && (("status" in change && change.status === "suspended") || ("role" in change && change.role === "seller"))) {
    return { ok: false, error: "No puedes suspenderte ni quitarte el rol de admin a ti misma." };
  }

  const { data: updated, error } = await supabase.from("profiles")
    .update(change).eq("id", accountId).select("id").maybeSingle();
  if (error || !updated) return { ok: false, error: "No pudimos guardar el cambio de la cuenta." };

  revalidatePath("/panel/admin/vendedoras");
  // A newly approved or suspended seller's products appear in or vanish from the storefront.
  revalidatePath("/");
  return { ok: true };
}
