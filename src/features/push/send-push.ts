import "server-only";

import webpush from "web-push";
import { buildPushPayload, isGoneSubscription, readPushConfig, type PushMessage } from "@/features/push/push-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Sends one notification to every device of these users. Never throws: a failed push must not
// fail the action that caused it (the message is saved, the reservation made). Without VAPID
// keys or the secret key it does nothing.
export async function pushToUsers(userIds: readonly (string | null | undefined)[], message: PushMessage): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const config = readPushConfig(process.env);
  const admin = createSupabaseAdminClient();
  if (ids.length === 0 || !config || !admin) return;

  try {
    const { data: subscriptions } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id", ids);
    if (!subscriptions?.length) return;
    const payload = buildPushPayload(message);
    const options = { vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey }, TTL: 60 * 60 * 24 };
    const gone: string[] = [];
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, options);
      } catch (error) {
        if (isGoneSubscription((error as { statusCode?: number }).statusCode)) gone.push(subscription.id);
        else console.warn("Web push failed", (error as Error).message);
      }
    }));
    if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  } catch (error) {
    console.warn("Web push skipped", (error as Error).message);
  }
}
