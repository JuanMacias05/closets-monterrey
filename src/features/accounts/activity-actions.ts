"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  invalid_store_name: "El nombre de tu bazar es demasiado largo (máximo 60 caracteres).",
  invalid_name: "Escribe tu nombre (2 a 80 caracteres).",
};

// "Quiero vender" / "Quiero entregar" and the sign-up checkboxes: the signed-in account asks for
// an activity, which starts pending until an admin approves (selling) or verifies her in person
// (delivering). request_activity (20261127000100) does the work; asking twice is harmless.
export async function requestActivities(input: { sell: boolean; deliver: boolean; storeName?: string; fullName?: string }): Promise<Result> {
  if (!input || typeof input.sell !== "boolean" || typeof input.deliver !== "boolean") return { ok: false, error: "Datos no válidos." };
  const storeName = typeof input.storeName === "string" ? input.storeName.trim() : "";
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  if (input.sell && storeName.length > 60) return { ok: false, error: ERRORS.invalid_store_name! };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión para continuar." };

  for (const [activity, wanted] of [["sell", input.sell], ["deliver", input.deliver]] as const) {
    if (!wanted) continue;
    const { error } = await supabase.rpc("request_activity", {
      activity,
      store_name: activity === "sell" ? storeName || null : null,
      full_name: activity === "deliver" ? fullName || null : null,
    });
    if (error) {
      const code = Object.keys(ERRORS).find((key) => error.message.includes(key));
      return { ok: false, error: code ? ERRORS[code]! : "No pudimos enviar tu solicitud. Inténtalo de nuevo." };
    }
  }
  // The green bar appears (with its "en revisión" note) on every page.
  revalidatePath("/", "layout");
  return { ok: true };
}
