import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Viewer =
  | { kind: "guest" }
  // Signed in, but without an approved seller/admin profile (pending, suspended, or no profile).
  // They get the guest storefront plus "Cerrar sesión" — never the seller tools.
  | { kind: "member"; userId: string }
  | { kind: "seller" | "admin"; userId: string; storeName: string };

// Cached per request: the header and every product card ask for the viewer, and each
// lookup is an auth round-trip plus a profiles query.
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { kind: "guest" };

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { kind: "guest" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_name,role,status")
    .eq("id", user.id)
    .maybeSingle();

  // Mirrors the panel layout's gate so the storefront never offers tools the panel would refuse.
  if (!profile || profile.status !== "approved" || !["seller", "admin"].includes(profile.role)) {
    return { kind: "member", userId: user.id };
  }
  return { kind: profile.role as "seller" | "admin", userId: user.id, storeName: profile.store_name };
});

export function isSellerViewer(viewer: Viewer): viewer is Extract<Viewer, { kind: "seller" | "admin" }> {
  return viewer.kind === "seller" || viewer.kind === "admin";
}
