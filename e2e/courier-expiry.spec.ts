import { expect, test } from "@playwright/test";

// The 5-minute webhook (20261126000300) that expires courier requests and claims their pushes.
// No login: the fixture is written with the local secret key, like the other specs' resets.
const SELLER_ID = "10000000-0000-4000-8000-000000000001"; // Closet de Renata
const COURIER_ID = "10000000-0000-4000-8000-000000000006"; // Lupita Recolectora
const CRON_SECRET = "e2e-cron-webhook-secret-0123456789"; // playwright.config.ts webServer env

function adminHeaders() {
  const key = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Run through `npm run test:e2e` so the local Supabase keys are set.");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
}

test("the webhook expires an unanswered courier request and claims it once", async ({ request }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const headers = adminHeaders();
  const now = Date.now();
  // A reservation whose courier never answered (no buyer account needed: buyer_id may be null).
  const [reservation] = (await (await fetch(`${url}/rest/v1/reservations`, {
    method: "POST", headers,
    body: JSON.stringify({
      seller_id: SELLER_ID, items_total_mxn: 30000, deposit_percent: 20, deposit_mxn: 6000, deposit_clabe: "002010077777777771",
      expires_at: new Date(now + 12 * 3600_000).toISOString(), delivery_method: "courier", delivery_address: "Calle Webhook 1, Centro",
      courier_id: COURIER_ID, courier_fee_payment: "on_delivery", buyer_municipality: "Monterrey", delivery_fee_mxn: 4500,
    }),
  })).json()) as { id: string }[];
  const [courierRequest] = (await (await fetch(`${url}/rest/v1/courier_requests`, {
    method: "POST", headers,
    body: JSON.stringify({
      reservation_id: reservation!.id, courier_id: COURIER_ID, fee_mxn: 4500, fee_payment: "on_delivery",
      requested_at: new Date(now - 2 * 3600_000 - 60_000).toISOString(), expires_at: new Date(now - 60_000).toISOString(),
    }),
  })).json()) as { id: string }[];

  try {
    expect((await request.post("/api/cron/courier-expiry")).status()).toBe(401);
    expect((await request.post("/api/cron/courier-expiry", { headers: { Authorization: "Bearer wrong-secret-0123456789" } })).status()).toBe(401);

    const first = await request.post("/api/cron/courier-expiry", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    expect(first.status()).toBe(200);
    expect((await first.json()).events).toBeGreaterThanOrEqual(1);
    const [row] = (await (await fetch(`${url}/rest/v1/courier_requests?id=eq.${courierRequest!.id}&select=status,expiry_notified_at`, { headers })).json()) as { status: string; expiry_notified_at: string | null }[];
    expect(row!.status).toBe("expired");
    expect(row!.expiry_notified_at).not.toBeNull();

    // A second ping finds nothing new to tell.
    const second = await request.post("/api/cron/courier-expiry", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    expect((await second.json()).events).toBe(0);
  } finally {
    await fetch(`${url}/rest/v1/reservations?id=eq.${reservation!.id}`, { method: "DELETE", headers });
  }
});
