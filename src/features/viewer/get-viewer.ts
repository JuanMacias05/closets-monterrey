import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Viewer =
  | { kind: "guest" }
  // A shopper: signed up through the buyer form, so she has a buyer profile and no store.
  | { kind: "buyer"; userId: string; fullName: string }
  // A courier ("recolectora"); pending until an admin verifies her.
  | { kind: "courier"; userId: string; fullName: string; status: string }
  // Signed in, but neither a buyer nor an approved seller/admin (pending or suspended
  // seller). They get the guest storefront plus "Cerrar sesión" — never the seller tools.
  | { kind: "member"; userId: string }
  | { kind: "seller" | "admin"; userId: string; storeName: string };

// Cached per request: the header and every product card ask for the viewer, and each
// lookup is an auth round-trip plus a profile query.
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { kind: "guest" };

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { kind: "guest" };

  const [{ data: profile }, { data: buyer }, { data: courier }] = await Promise.all([
    supabase.from("profiles").select("store_name,role,status").eq("id", user.id).maybeSingle(),
    supabase.from("buyer_profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("couriers").select("full_name,status").eq("id", user.id).maybeSingle(),
  ]);

  // Mirrors the panel layout's gate so the storefront never offers tools the panel would refuse.
  if (profile && profile.status === "approved" && ["seller", "admin"].includes(profile.role)) {
    return { kind: profile.role as "seller" | "admin", userId: user.id, storeName: profile.store_name };
  }
  if (courier) return { kind: "courier", userId: user.id, fullName: courier.full_name, status: courier.status };
  if (buyer) return { kind: "buyer", userId: user.id, fullName: buyer.full_name };
  return { kind: "member", userId: user.id };
});

export function isSellerViewer(viewer: Viewer): viewer is Extract<Viewer, { kind: "seller" | "admin" }> {
  return viewer.kind === "seller" || viewer.kind === "admin";
}

// Buyers and approved sellers/admins can shop; sellers buy like anyone else.
export function canShop(viewer: Viewer): viewer is Extract<Viewer, { userId: string }> {
  return viewer.kind === "buyer" || isSellerViewer(viewer);
}
