"use server";

import { revalidatePath } from "next/cache";
import { parseAddPerson, type AddPersonInput } from "@/features/accounts/people";
import { isAdminUser } from "@/features/viewer/is-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true; existed?: boolean } | { ok: false; error: string };

const ACTIVITY_ERRORS: Record<string, string> = {
  own_admin: "No puedes quitarte a ti misma la administración.",
  invalid_name: "Escribe su nombre para darle la actividad de entregar.",
  invalid_store_name: "El nombre de su tienda es demasiado largo (máximo 60).",
  not_allowed: "Solo la administración puede cambiar actividades.",
  not_found: "No encontramos esa cuenta.",
};

async function adminSession() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión." };
  // Re-checked here for a clear message; admin_set_activities checks it again in the database.
  if (!(await isAdminUser(supabase, user.id))) return { ok: false as const, error: "Solo la administración puede agregar o cambiar personas." };
  return { ok: true as const, supabase, userId: user.id };
}

function revalidatePeople() {
  revalidatePath("/panel/admin/vendedoras");
  revalidatePath("/panel/admin/recolectoras");
  revalidatePath("/recolectoras");
  revalidatePath("/");
}

// "+ Agregar persona": finds the account by phone or creates it (already confirmed, so she logs
// in with her SMS code the first time), then grants the checked activities already approved,
// the owner's default. An existing account keeps what it had; the checked ones are added.
//
// IMPORTANT: the secret key is used only for the two things a session cannot do (look up and
// create an auth user by phone). The grant itself goes through the admin's own session, so the
// database's admin check applies. Nothing here logs or returns the key.
export async function addPerson(input: AddPersonInput): Promise<Result> {
  const parsed = parseAddPerson(input);
  if (!parsed.ok) return parsed;
  const { person } = parsed;
  const session = await adminSession();
  if (!session.ok) return session;
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Falta configurar SUPABASE_SECRET_KEY en el servidor para agregar personas." };

  const { data: found, error: findError } = await admin.rpc("find_user_by_phone", { phone_e164: person.phoneE164 });
  if (findError) return { ok: false, error: "No pudimos buscar ese teléfono. Inténtalo de nuevo." };
  let userId = (found as string | null) ?? null;
  const existed = userId !== null;
  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      phone: person.phoneE164,
      phone_confirm: true,
      // The sign-up trigger creates nothing for this type; the grant below decides everything.
      user_metadata: { account_type: "added_by_admin", full_name: person.fullName },
    });
    if (createError || !created.user) return { ok: false, error: "No pudimos crear la cuenta con ese teléfono." };
    userId = created.user.id;
  }

  const { error } = await session.supabase.rpc("admin_set_activities", {
    target: userId,
    // null = leave as it is: on an existing account only the checked activities change.
    sell: person.sell ? true : null,
    deliver: person.deliver ? true : null,
    administer: person.administer ? true : null,
    store_name: person.storeName,
    full_name: person.fullName,
  });
  if (error) {
    const code = Object.keys(ACTIVITY_ERRORS).find((key) => error.message.includes(key));
    return { ok: false, error: code ? ACTIVITY_ERRORS[code]! : "No pudimos darle sus actividades." };
  }
  revalidatePeople();
  return { ok: true, existed };
}

// The activity editor in the lists: exactly these activities (unchecked ones are suspended).
export async function setPersonActivities(targetId: string, activities: { sell: boolean; deliver: boolean; administer: boolean }): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/i.test(targetId) || !activities
    || typeof activities.sell !== "boolean" || typeof activities.deliver !== "boolean" || typeof activities.administer !== "boolean") {
    return { ok: false, error: "Datos no válidos." };
  }
  const session = await adminSession();
  if (!session.ok) return session;
  const { error } = await session.supabase.rpc("admin_set_activities", {
    target: targetId, sell: activities.sell, deliver: activities.deliver, administer: activities.administer, store_name: null, full_name: null,
  });
  if (error) {
    const code = Object.keys(ACTIVITY_ERRORS).find((key) => error.message.includes(key));
    return { ok: false, error: code ? ACTIVITY_ERRORS[code]! : "No pudimos guardar sus actividades." };
  }
  revalidatePeople();
  return { ok: true };
}
