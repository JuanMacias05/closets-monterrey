import "server-only";

import { redirect } from "next/navigation";
import { getViewer, type AccountViewer } from "@/features/viewer/get-viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Every page of the courier's area calls this, not only its layout: a layout is not rendered
// again when she moves between its pages, so it cannot be the only gate. Any account with the
// delivering activity gets in (also sellers and admins who deliver); a pending or suspended
// courier sees the banners the layout draws.
export async function requireCourier(nextPath: string): Promise<{ viewer: AccountViewer; courier: NonNullable<AccountViewer["courier"]>; supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>> }> {
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!viewer.courier) redirect("/cuenta/entregar");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  return { viewer, courier: viewer.courier, supabase };
}
