import { courierExpiryPushes, isAuthorizedCronRequest, type ExpiryClaim } from "@/features/push/courier-expiry";
import { pushToUsers } from "@/features/push/send-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Called every 5 minutes by pg_cron + pg_net (20261126000300), not by Vercel Cron (Hobby runs
// it once a day). It runs the courier-request expiry and sends one push per claimed event; the
// database stamps each event as it hands it over, so overlapping calls never notify twice.
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_WEBHOOK_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "SUPABASE_SECRET_KEY is not set" }, { status: 503 });

  const { data, error } = await admin.rpc("claim_courier_expiry_notifications");
  if (error) return Response.json({ error: "claim failed" }, { status: 500 });
  const claims = (data ?? []) as ExpiryClaim[];
  const pushes = claims.flatMap(courierExpiryPushes);
  // pushToUsers never throws; a failed push is logged and lost (the notice in /cuenta stays).
  await Promise.all(pushes.map((push) => pushToUsers([push.userId], push.message)));
  return Response.json({ events: claims.length, pushes: pushes.length }, { headers: { "Cache-Control": "no-store" } });
}
