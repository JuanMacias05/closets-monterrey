import { expect, test, type Page } from "@playwright/test";

// Home delivery priced by zone (20261123000100): an admin sets a rate, the buyer sees it as an
// estimate in her cart, the seller adjusts it before the deposit and the buyer sees the change.
// Three logins in all; the local SMS cap is 30/hour for the whole suite.

// Reserved in supabase/config.toml [auth.sms.test_otp]. Shared with courier.spec.ts: both
// delete this buyer before and after, and the suite runs one spec at a time (workers: 1).
const BUYER_PHONE = "+528100000007";
const SELLER_PHONE = "+528100000001"; // Closet de Renata: ships from Monterrey (seed)
const ADMIN_PHONE = "+528100000004";
const PRODUCT_ID = "20000000-0000-4000-8000-000000000002"; // Blusa de lino arena, $480
const PRODUCT_SLUG = "blusa-lino-arena";
const SERVER_ACTION_TIMEOUT = 15_000;

function adminHeaders() {
  const key = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Run through `npm run test:e2e` so the local Supabase keys are set.");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// Puts the garment back on sale, closes any reservation a failed run left open (an open one
// would show up in other specs' seller checks), removes the buyer and restores the seeded
// placeholder rates from Monterrey. The secret key has no user, so the rates come back
// "unreviewed" (updated_by null), as seeded.
async function resetFixtures() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const headers = adminHeaders();
  const held = (await (await fetch(`${url}/rest/v1/reservation_items?product_id=eq.${PRODUCT_ID}&active=eq.true&select=reservation_id`, { headers })).json()) as { reservation_id: string }[];
  if (held.length) {
    const ids = held.map((row) => row.reservation_id).join(",");
    await fetch(`${url}/rest/v1/reservations?id=in.(${ids})&status=in.(pending_deposit,confirmed)`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "cancelled", closed_at: new Date().toISOString() }),
    });
  }
  await fetch(`${url}/rest/v1/reservation_items?product_id=eq.${PRODUCT_ID}&active=eq.true`, { method: "PATCH", headers, body: JSON.stringify({ active: false }) });
  await fetch(`${url}/rest/v1/products?id=eq.${PRODUCT_ID}`, {
    method: "PATCH", headers, body: JSON.stringify({ sale_status: "available", reserved_at: null, sold_at: null }),
  });
  const { users } = (await (await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers })).json()) as { users: { id: string; phone?: string }[] };
  const buyer = users.find((user) => user.phone === BUYER_PHONE.replace("+", ""));
  if (buyer) await fetch(`${url}/auth/v1/admin/users/${buyer.id}`, { method: "DELETE", headers });
  // Checked: a failed restore would leave "reviewed" rates and fail the next run far from here.
  for (const [filter, fee] of [["origin_municipality=eq.Monterrey", 10000], ["origin_municipality=eq.Monterrey&destination_municipality=eq.Monterrey", 6000]] as const) {
    const response = await fetch(`${url}/rest/v1/delivery_zone_rates?${filter}`, { method: "PATCH", headers, body: JSON.stringify({ fee_mxn: fee }) });
    if (!response.ok) throw new Error(`Could not restore the placeholder rates: ${await response.text()}`);
  }
}

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(phone);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 20_000 });
}

test.setTimeout(120_000);
test.beforeAll(resetFixtures);
test.afterAll(resetFixtures);

test("an admin prices a zone, the buyer reserves with that estimate and the seller adjusts it", async ({ page, browser }) => {
  // The admin sets Monterrey → Apodaca from the panel's menu.
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, ADMIN_PHONE);
  await admin.getByRole("button", { name: /^Panel/ }).click();
  await admin.getByRole("group", { name: "Panel" }).getByRole("link", { name: "Tarifas de envío" }).click();
  await expect(admin.getByRole("heading", { name: "Tarifas de envío", level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(admin.getByText("Todas las tarifas son de ejemplo")).toBeVisible();
  await expect(admin.getByRole("link", { name: /^Monterrey/ })).toHaveAttribute("aria-current", "page");
  await admin.getByLabel("Envío de Monterrey a Apodaca, en pesos").fill("95");
  await admin.getByRole("button", { name: "Guardar tarifas desde Monterrey" }).click();
  await expect(admin.getByText("Tarifas desde Monterrey guardadas.")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await admin.reload();
  await expect(admin.getByLabel("Envío de Monterrey a Apodaca, en pesos")).toHaveValue("95");
  await expect(admin.getByText(/^Revisadas el /)).toBeVisible();
  await adminContext.close();

  // The buyer signs up, adds the blouse and picks home delivery.
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill("Compradora Domicilio");
  await page.getByLabel("Link de tu perfil de Facebook").fill("facebook.com/compradora.domicilio");
  await page.getByLabel("Número de celular").fill(BUYER_PHONE);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page).toHaveURL(/\/cuenta$/, { timeout: 20_000 });

  await page.goto(`/prendas/${PRODUCT_SLUG}`);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("link", { name: /En tu carrito/ })).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  await page.goto("/carrito");
  await page.getByRole("button", { name: "Elegir entrega" }).click();
  await page.getByRole("radio", { name: /Envío a domicilio/ }).check();
  await expect(page.getByTestId("checkout-delivery-fee")).toHaveText("elige tu municipio");
  // The estimate, total and deposit follow her municipality as she changes it.
  await page.getByLabel("Tu municipio", { exact: true }).selectOption("Monterrey");
  await expect(page.getByText("Envío aprox. $60.00 MXN")).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toHaveText("$540.00 MXN");
  await page.getByLabel("Tu municipio", { exact: true }).selectOption("Apodaca");
  await expect(page.getByText("Envío aprox. $95.00 MXN (de Monterrey a Apodaca)")).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toHaveText("$575.00 MXN");
  // 20% of $480; the shipping is paid at the door, not in the deposit.
  await expect(page.getByTestId("checkout-deposit")).toHaveText("$96.00 MXN");
  await page.getByLabel("Dirección de entrega").fill("Av. Las Américas 450, Col. Pueblo Nuevo, Apodaca");
  await page.getByRole("button", { name: "Continuar al anticipo" }).click();
  await page.getByRole("button", { name: /Apartar · anticipo \$96\.00 MXN/ }).click();
  await expect(page).toHaveURL(/\/cuenta/, { timeout: SERVER_ACTION_TIMEOUT });
  await expect(page.getByText(/A domicilio · Av\. Las Américas 450.*\(envío \$95\.00 MXN, se paga al recibir\)/)).toBeVisible();
  await expect(page.getByText(/Total con envío: \$575\.00 MXN/)).toBeVisible();

  // The address is far: the seller raises the fee before the deposit arrives.
  const sellerContext = await browser.newContext();
  const seller = await sellerContext.newPage();
  await login(seller, SELLER_PHONE);
  await seller.goto("/panel/apartados");
  const card = seller.getByRole("listitem").filter({ hasText: "Compradora Domicilio" }).first();
  await expect(card.getByText(/Envío estimado de Monterrey a Apodaca/)).toBeVisible();
  await card.getByRole("button", { name: "Ajustar envío" }).click();
  await card.getByLabel("Nuevo costo del envío (MXN)").fill("120");
  seller.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Guardar envío" }).click();
  await expect(card.getByText("Ajustaste el envío de $95.00 MXN a $120.00 MXN.")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await expect(card.getByTestId("seller-balance")).toHaveText("$504.00 MXN"); // $480 − $96 + $120

  // Where she ships from lives in her store settings.
  await seller.goto("/panel/tienda");
  await expect(seller.getByLabel("¿Desde qué municipio envías?")).toHaveValue("Monterrey");
  await sellerContext.close();

  // The buyer sees the change and the new total, and can still back out.
  await page.reload();
  const change = page.getByTestId("delivery-fee-change");
  await expect(change).toContainText("La tienda ajustó el envío de $95.00 MXN a $120.00 MXN.");
  await expect(change).toContainText("Nuevo total con envío: $600.00 MXN.");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar apartado" }).click();
  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
});
