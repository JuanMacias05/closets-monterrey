"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setAdminProductVisibility(productId: string, hidden: boolean): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Inicia sesión para administrar el catálogo." };

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role,status").eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.role !== "admin" || profile.status !== "approved") {
    return { ok: false, error: "Solo la administración puede cambiar la visibilidad del catálogo." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(productId) || typeof hidden !== "boolean") {
    return { ok: false, error: "Los datos para cambiar la visibilidad no son válidos." };
  }

  const { data: product, error: productError } = await supabase.from("products")
    .select("id,slug").eq("id", productId).maybeSingle();
  if (productError || !product) return { ok: false, error: "No encontramos esa prenda." };

  const { data: updated, error: updateError } = await supabase.from("products")
    .update({ hidden_by_admin: hidden }).eq("id", productId).select("id").maybeSingle();
  if (updateError || !updated) return { ok: false, error: "No pudimos cambiar la visibilidad de la prenda." };

  revalidatePath("/panel/admin/prendas");
  revalidatePath("/panel/prendas");
  revalidatePath("/");
  revalidatePath(`/prendas/${product.slug}`);
  return { ok: true };
}
