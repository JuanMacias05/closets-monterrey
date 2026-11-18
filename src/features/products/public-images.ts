import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogImage } from "@/features/products/types";

export function getProductImageUrl(
  supabase: SupabaseClient,
  image: Pick<CatalogImage, "source" | "storage_path">,
) {
  if (image.source === "local_placeholder") return image.storage_path;

  return supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl;
}

export function getSellerAvatarUrl(supabase: SupabaseClient, avatarPath: string | null | undefined) {
  if (!avatarPath) return null;
  if (avatarPath.startsWith("/") || /^https?:\/\//i.test(avatarPath)) return avatarPath;

  return supabase.storage.from("product-images").getPublicUrl(avatarPath).data.publicUrl;
}
