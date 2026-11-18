"use server";

import { revalidatePath } from "next/cache";
import { normalizePhoneE164 } from "@/features/auth/phone-number";
import { isValidClabe } from "@/features/store/clabe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StoreSettingsInput = {
  storeName: string;
  avatarPath: string | null;
  whatsapp: string;
  clabe: string;
};

export async function saveStoreSettings(input: StoreSettingsInput) {
  if (
    !input ||
    typeof input.storeName !== "string" ||
    (input.avatarPath !== null && typeof input.avatarPath !== "string") ||
    typeof input.whatsapp !== "string" ||
    typeof input.clabe !== "string"
  ) {
    return { ok: false as const, error: "Los datos de la tienda no son válidos." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "No está configurada la conexión con Supabase." };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { ok: false as const, error: "Inicia sesión para guardar tu tienda." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,status,avatar_path")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.status !== "approved" || !["seller", "admin"].includes(profile.role)) {
    return { ok: false as const, error: "Tu cuenta no tiene permiso para editar esta tienda." };
  }

  const storeName = input.storeName.trim();
  if (!storeName || storeName.length > 80) {
    return { ok: false as const, error: "El nombre debe tener entre 1 y 80 caracteres." };
  }

  const whatsapp = input.whatsapp.trim() ? normalizePhoneE164(input.whatsapp) : null;
  if (input.whatsapp.trim() && !whatsapp) {
    return { ok: false as const, error: "Escribe un WhatsApp válido con código de país o con 10 dígitos de México." };
  }

  const clabeInput = input.clabe.trim();
  const clabe = clabeInput || null;
  if (clabe && !isValidClabe(clabe)) {
    return { ok: false as const, error: "La CLABE debe tener 18 dígitos y un dígito verificador válido." };
  }

  const avatarPath = input.avatarPath?.trim() || null;
  const avatarPrefix = `sellers/${authData.user.id}/avatar/`;
  if (avatarPath && avatarPath !== profile.avatar_path && (!avatarPath.startsWith(avatarPrefix) || !/^sellers\/[0-9a-f-]+\/avatar\/[0-9a-f-]+\.jpg$/i.test(avatarPath))) {
    return { ok: false as const, error: "La ruta de la foto de tienda no es válida." };
  }

  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({ store_name: storeName, avatar_path: avatarPath })
    .eq("id", authData.user.id);
  if (updateProfileError) return { ok: false as const, error: "No pudimos guardar el nombre y la foto de tu tienda." };

  const { error: updateSettingsError } = await supabase
    .from("seller_private_settings")
    .update({ whatsapp_e164: whatsapp, clabe })
    .eq("seller_id", authData.user.id);
  if (updateSettingsError) return { ok: false as const, error: "No pudimos guardar el WhatsApp y la CLABE." };

  if (profile.avatar_path && profile.avatar_path !== avatarPath && profile.avatar_path.startsWith(avatarPrefix)) {
    const { error: removeError } = await supabase.storage.from("product-images").remove([profile.avatar_path]);
    if (removeError) console.error("No se pudo borrar la foto anterior de la tienda.", removeError);
  }

  revalidatePath("/");
  revalidatePath("/panel/tienda");
  return { ok: true as const };
}
