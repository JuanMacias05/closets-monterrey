"use server";

import { revalidatePath } from "next/cache";
import { PRODUCT_AUDIENCES, PRODUCT_CATEGORIES, PRODUCT_CONDITIONS, PRODUCT_SIZES, type ProductAudience, type ProductCondition } from "@/features/products/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
type CreateProductResult = { ok: true; productId: string } | { ok: false; error: string };
type ProductInput = {
  name: string;
  description: string;
  category: string;
  // Optional so older callers keep working; a missing value means "women", the column default.
  audience?: string;
  size: string;
  condition: string;
  price_mxn: number;
  measurements?: Record<string, number>;
};

async function getSellerContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, error: "Inicia sesión para administrar tus prendas." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role,status").eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.status !== "approved" || !["seller", "admin"].includes(profile.role)) {
    return { ok: false as const, error: "Tu cuenta no tiene permiso para administrar prendas." };
  }
  return { ok: true as const, supabase, userId: user.id };
}

function validProductInput(input: ProductInput) {
  return input && typeof input.name === "string" && input.name.trim().length > 0 && input.name.trim().length <= 100
    && typeof input.description === "string" && input.description.length <= 5000
    && PRODUCT_CATEGORIES.some((item) => item.value === input.category)
    && (input.audience === undefined || PRODUCT_AUDIENCES.some((item) => item.value === input.audience))
    && PRODUCT_SIZES.some((item) => item === input.size)
    && PRODUCT_CONDITIONS.some((item) => item.value === input.condition)
    && Number.isSafeInteger(input.price_mxn) && input.price_mxn >= 0 && input.price_mxn <= 100_000_000
    && (!input.measurements || (typeof input.measurements === "object" && Object.values(input.measurements).every((v) => Number.isFinite(v) && v >= 0)));
}

function productValues(input: ProductInput) {
  return {
    name: input.name.trim(), description: input.description.trim(), category: input.category,
    audience: (input.audience ?? "women") as ProductAudience,
    size: input.size, condition: input.condition as ProductCondition, price_mxn: input.price_mxn,
    measurements: input.measurements ?? {}, publication_status: "published" as const,
  };
}

function revalidateProducts() {
  revalidatePath("/panel/prendas");
  revalidatePath("/");
}

export async function createProduct(input: ProductInput): Promise<CreateProductResult> {
  const context = await getSellerContext();
  if (!context.ok) return context;
  if (!validProductInput(input)) return { ok: false, error: "Revisa los datos de la prenda." };

  const { data, error } = await context.supabase.from("products").insert({
    ...productValues(input), seller_id: context.userId, sale_status: "available", hidden_by_admin: false,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "No pudimos crear la prenda." };
  revalidateProducts();
  return { ok: true, productId: data.id };
}

export async function updateProduct(productId: string, input: ProductInput): Promise<Result> {
  const context = await getSellerContext();
  if (!context.ok) return context;
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !validProductInput(input)) return { ok: false, error: "Revisa los datos de la prenda." };

  const { data: owned } = await context.supabase.from("products").select("id")
    .eq("id", productId).eq("seller_id", context.userId).maybeSingle();
  if (!owned) return { ok: false, error: "No encontramos esa prenda en tu tienda." };

  const { error } = await context.supabase.from("products").update(productValues(input))
    .eq("id", productId).eq("seller_id", context.userId);
  if (error) return { ok: false, error: "No pudimos guardar los cambios de la prenda." };
  revalidateProducts();
  revalidatePath(`/panel/prendas/${productId}`);
  return { ok: true };
}

// Quick price edit from "Mis prendas". Only while the garment is available: an open
// reservation already froze its price in reservation_items, and changing the list price
// under it would show the buyer one number and the seller another.
export async function setProductPrice(productId: string, priceInCents: number): Promise<Result> {
  const context = await getSellerContext();
  if (!context.ok) return context;
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !Number.isSafeInteger(priceInCents) || priceInCents < 0 || priceInCents > 100_000_000) {
    return { ok: false, error: "Escribe un precio válido." };
  }
  const { data: owned } = await context.supabase.from("products").select("id,sale_status")
    .eq("id", productId).eq("seller_id", context.userId).maybeSingle();
  if (!owned) return { ok: false, error: "No encontramos esa prenda en tu tienda." };
  if (owned.sale_status !== "available") return { ok: false, error: "Solo puedes cambiar el precio de una prenda disponible." };
  const { error } = await context.supabase.from("products").update({ price_mxn: priceInCents })
    .eq("id", productId).eq("seller_id", context.userId);
  if (error) return { ok: false, error: "No pudimos guardar el precio." };
  revalidateProducts();
  return { ok: true };
}

export async function setProductSaleStatus(productId: string, status: "available" | "sold"): Promise<Result> {
  const context = await getSellerContext();
  if (!context.ok) return context;
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !["available", "sold"].includes(status)) {
    return { ok: false, error: "No pudimos actualizar el estado de la prenda." };
  }
  const { data: owned } = await context.supabase.from("products").select("id")
    .eq("id", productId).eq("seller_id", context.userId).maybeSingle();
  if (!owned) return { ok: false, error: "No encontramos esa prenda en tu tienda." };
  const { error } = await context.supabase.from("products").update({
    sale_status: status, sold_at: status === "sold" ? new Date().toISOString() : null, reserved_at: null,
  }).eq("id", productId).eq("seller_id", context.userId);
  if (error) return { ok: false, error: "No pudimos actualizar el estado de la prenda." };
  revalidateProducts();
  return { ok: true };
}

export async function registerProductImage(input: {
  productId: string; storagePath: string; altText: string; width: number; height: number;
}): Promise<Result & { imageId?: string }> {
  const context = await getSellerContext();
  if (!context.ok) return context;
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.productId) || !Number.isInteger(input.width) || !Number.isInteger(input.height)
    || input.width < 1 || input.height < 1 || typeof input.altText !== "string" || input.altText.length > 200
    || typeof input.storagePath !== "string"
    || !input.storagePath.startsWith(`sellers/${context.userId}/products/${input.productId}/`)
    || !/^sellers\/[0-9a-f-]+\/products\/[0-9a-f-]+\/[0-9a-f-]+\.jpg$/i.test(input.storagePath)) {
    return { ok: false, error: "Los datos de la foto no son válidos." };
  }
  const { data: owned } = await context.supabase.from("products").select("id")
    .eq("id", input.productId).eq("seller_id", context.userId).maybeSingle();
  if (!owned) return { ok: false, error: "No encontramos esa prenda en tu tienda." };
  const { count, error: countError } = await context.supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", input.productId);
  if (countError) return { ok: false, error: "No pudimos preparar la foto." };
  const { data, error } = await context.supabase.from("product_images").insert({
    product_id: input.productId, source: "storage", storage_path: input.storagePath,
    alt_text: input.altText, position: count ?? 0, width: input.width, height: input.height,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "No pudimos guardar los datos de la foto." };
  revalidatePath(`/panel/prendas/${input.productId}`);
  return { ok: true, imageId: data.id };
}

export async function reorderProductImages(productId: string, imageIds: string[]): Promise<Result> {
  const context = await getSellerContext();
  if (!context.ok) return context;
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !Array.isArray(imageIds) || imageIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    return { ok: false, error: "El orden de las fotos no es válido." };
  }
  const { data: owned } = await context.supabase.from("products").select("id")
    .eq("id", productId).eq("seller_id", context.userId).maybeSingle();
  if (!owned) return { ok: false, error: "No encontramos esa prenda en tu tienda." };
  const { error } = await context.supabase.rpc("reorder_product_images", { target_product_id: productId, ordered_image_ids: imageIds });
  if (error) return { ok: false, error: "No pudimos reordenar las fotos." };
  revalidatePath(`/panel/prendas/${productId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProductImage(imageId: string): Promise<Result> {
  const context = await getSellerContext();
  if (!context.ok) return context;
  if (!/^[0-9a-f-]{36}$/i.test(imageId)) return { ok: false, error: "No encontramos esa foto." };
  const { data: image } = await context.supabase.from("product_images").select("id,product_id,source,storage_path")
    .eq("id", imageId).maybeSingle();
  if (!image) return { ok: false, error: "No encontramos esa foto." };
  const { data: owned } = await context.supabase.from("products").select("id")
    .eq("id", image.product_id).eq("seller_id", context.userId).maybeSingle();
  if (!owned) return { ok: false, error: "No tienes permiso para borrar esta foto." };

  const { data: remaining } = await context.supabase.from("product_images").select("id,position")
    .eq("product_id", image.product_id).neq("id", imageId).order("position");
  const { error: deleteError } = await context.supabase.from("product_images").delete().eq("id", imageId);
  if (deleteError) return { ok: false, error: "No pudimos borrar la foto." };
  if (image.source === "storage") {
    const paths = [image.storage_path];
    const { data, error } = await context.supabase.storage.from("product-images").remove(paths);
    if (error || (data?.length ?? 0) !== paths.length) {
      console.error("No se pudo borrar el archivo de una foto eliminada.", error ?? { requested: paths.length, removed: data?.length ?? 0 });
    }
  }
  const ordered = (remaining ?? []).map((row) => row.id);
  if (ordered.length > 0) {
    const { error } = await context.supabase.rpc("reorder_product_images", { target_product_id: image.product_id, ordered_image_ids: ordered });
    if (error) console.error("No se pudieron compactar las posiciones de las fotos.", error);
  }
  revalidatePath(`/panel/prendas/${image.product_id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProductWithImages(productId: string): Promise<Result> {
  const context = await getSellerContext();
  if (!context.ok) return context;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false, error: "No encontramos esa prenda." };
  const { data: product } = await context.supabase.from("products").select("id")
    .eq("id", productId).eq("seller_id", context.userId).maybeSingle();
  if (!product) return { ok: false, error: "No encontramos esa prenda en tu tienda." };
  const { data: images, error: imagesError } = await context.supabase.from("product_images")
    .select("source,storage_path").eq("product_id", productId);
  if (imagesError) return { ok: false, error: "No pudimos preparar las fotos para borrar." };

  const { data: deleted, error: deleteError } = await context.supabase.from("products").delete()
    .eq("id", productId).eq("seller_id", context.userId).select("id").maybeSingle();
  if (deleteError || !deleted) return { ok: false, error: "No pudimos borrar la prenda." };
  const paths = (images ?? []).filter((image) => image.source === "storage").map((image) => image.storage_path);
  if (paths.length > 0) {
    const { data, error } = await context.supabase.storage.from("product-images").remove(paths);
    if (error || (data?.length ?? 0) !== paths.length) {
      console.error("La prenda se borró, pero no se pudieron borrar sus archivos de Storage.", error ?? { requested: paths.length, removed: data?.length ?? 0 });
    }
  }
  revalidateProducts();
  return { ok: true };
}
