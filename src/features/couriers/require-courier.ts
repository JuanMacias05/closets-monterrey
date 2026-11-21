import "server-only";

import { redirect } from "next/navigation";
import { getViewer } from "@/features/viewer/get-viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Every page of the courier's area calls this, not only its layout: a layout is not rendered
// again when she moves between its pages, so it cannot be the only gate.
export async function requireCourier(nextPath: string) {
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (viewer.kind !== "courier") redirect("/");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  return { viewer, supabase };
}
