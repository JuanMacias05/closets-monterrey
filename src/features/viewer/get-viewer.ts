import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { VIEW_AS_BUYER_COOKIE } from "@/features/viewer/view-as";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActivityStatus = "pending" | "approved" | "suspended";

// One account, several activities (20261127000100). Every signed-in account can buy; selling,
// delivering and administering are independent and any mix is possible.
export type Viewer =
  | { kind: "guest" }
  | {
    kind: "account";
    userId: string;
    // What the store shows as her name: her buyer name, her store or her courier name.
    name: string;
    buyer: boolean;
    seller: { status: ActivityStatus; storeName: string; slug: string | null } | null;
    courier: { status: ActivityStatus; fullName: string } | null;
    admin: boolean;
  };

export type AccountViewer = Extract<Viewer, { kind: "account" }>;

// Cached per request: the header and every product card ask for the viewer, and each lookup
// is an auth round-trip plus a few small queries.
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { kind: "guest" };

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { kind: "guest" };

  const [{ data: profile }, { data: buyer }, { data: courier }, { data: admin }] = await Promise.all([
    supabase.from("profiles").select("store_name,slug,status").eq("id", user.id).maybeSingle(),
    supabase.from("buyer_profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("couriers").select("full_name,status").eq("id", user.id).maybeSingle(),
    supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    kind: "account",
    userId: user.id,
    name: buyer?.full_name ?? profile?.store_name ?? courier?.full_name ?? "Mi cuenta",
    buyer: Boolean(buyer),
    seller: profile ? { status: profile.status as ActivityStatus, storeName: profile.store_name, slug: profile.slug } : null,
    courier: courier ? { status: courier.status as ActivityStatus, fullName: courier.full_name } : null,
    admin: Boolean(admin),
  };
});

export function isApprovedSeller(viewer: Viewer): viewer is AccountViewer {
  return viewer.kind === "account" && viewer.seller?.status === "approved";
}

export function isApprovedCourier(viewer: Viewer): viewer is AccountViewer {
  return viewer.kind === "account" && viewer.courier?.status === "approved";
}

// Buying is always on: any signed-in account can shop.
export function canShop(viewer: Viewer): viewer is AccountViewer {
  return viewer.kind === "account";
}

// "Ver como clienta" (admins): the header draws the store as a buyer-only account sees it. It is
// presentation only and never feeds a permission check: pages and the database still use the
// real activities above.
export const getViewAsBuyer = cache(async (): Promise<boolean> => {
  const viewer = await getViewer();
  if (viewer.kind !== "account" || !viewer.admin) return false;
  return (await cookies()).get(VIEW_AS_BUYER_COOKIE)?.value === "1";
});
