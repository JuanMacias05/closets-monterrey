"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getAuthorizedContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { ok: false as const, error: "Inicia sesión para administrar fotos." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", authData.user.id)
    .maybeSingle();

  return {
    ok: true as const,
    supabase,
    userId: authData.user.id,
    isAdmin: profile?.role === "admin" && profile.status === "approved",
  };
}

async function removeStorageFiles(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, paths: string[]) {
  if (paths.length === 0) return null;
  const { error } = await supabase.storage.from("product-images").remove(paths);
  return error;
}

/** Delete the object before its metadata so a failed Storage removal is retryable. */
export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  const context = await getAuthorizedContext();
  if (!context.ok) return context;

  const { data: image, error: imageError } = await context.supabase
    .from("product_images")
    .select("id,source,storage_path,product:products!product_images_product_id_fkey(seller_id)")
    .eq("id", imageId)
    .maybeSingle();

  if (imageError || !image) return { ok: false, error: "No encontramos esa foto." };
  const product = Array.isArray(image.product) ? image.product[0] : image.product;
  if (!context.isAdmin && product?.seller_id !== context.userId) {
    return { ok: false, error: "No tienes permiso para borrar esta foto." };
  }

  if (image.source === "storage") {
    const removeError = await removeStorageFiles(context.supabase, [image.storage_path]);
    if (removeError) return { ok: false, error: `No se pudo borrar el archivo: ${removeError.message}` };
  }

  const { data: deleted, error: deleteError } = await context.supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    return { ok: false, error: "El archivo se borró, pero no pudimos actualizar sus datos. Actualiza la ficha antes de continuar." };
  }
  return { ok: true };
}

/** Remove all image objects as part of the authenticated product deletion flow. */
export async function deleteProductWithImages(productId: string): Promise<ActionResult> {
  const context = await getAuthorizedContext();
  if (!context.ok) return context;

  const { data: product, error: productError } = await context.supabase
    .from("products")
    .select("id,seller_id")
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) return { ok: false, error: "No encontramos esa prenda." };
  if (!context.isAdmin && product.seller_id !== context.userId) {
    return { ok: false, error: "No tienes permiso para borrar esta prenda." };
  }

  const { data: images, error: imagesError } = await context.supabase
    .from("product_images")
    .select("source,storage_path")
    .eq("product_id", productId);

  if (imagesError) return { ok: false, error: "No pudimos preparar las fotos para borrar." };
  const paths = (images ?? [])
    .filter((image) => image.source === "storage")
    .map((image) => image.storage_path);
  const removeError = await removeStorageFiles(context.supabase, paths);
  if (removeError) return { ok: false, error: `No se pudo borrar una o más fotos: ${removeError.message}` };

  const { data: deleted, error: deleteError } = await context.supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    return { ok: false, error: "Las fotos se borraron, pero no pudimos eliminar la prenda. Actualiza la página antes de continuar." };
  }
  return { ok: true };
}
