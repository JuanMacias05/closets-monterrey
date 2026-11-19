import { expect, test, type Page } from "@playwright/test";

// Reserved in supabase/config.toml [auth.sms.test_otp].
const BUYER_PHONE = "+528100000007";
const SELLER_PHONE = "+528100000001"; // Closet de Renata, reaches Padre Mier
const COURIER_PHONE = "+528100000006"; // Lupita Recolectora: Padre Mier -> Monterrey, $45
const PRODUCT_ID = "20000000-0000-4000-8000-000000000005"; // Vestido floral de verano, $650
const PRODUCT_SLUG = "vestido-floral";

function adminHeaders() {
  const key = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Run through `npm run test:e2e` so the local Supabase keys are set.");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function resetFixtures() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const headers = adminHeaders();
  const { users } = (await (await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers })).json()) as { users: { id: string; phone?: string }[] };
  const buyer = users.find((user) => user.phone === BUYER_PHONE.replace("+", ""));
  if (buyer) await fetch(`${url}/auth/v1/admin/users/${buyer.id}`, { method: "DELETE", headers });
  await fetch(`${url}/rest/v1/products?id=eq.${PRODUCT_ID}`, {
    method: "PATCH", headers, body: JSON.stringify({ sale_status: "available", reserved_at: null, sold_at: null }),
  });
}

async function login(page: Page, phone: string, expectedPath: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(phone);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(expectedPath, { timeout: 20_000 });
}

test.setTimeout(120_000);
test.beforeAll(resetFixtures);
test.afterAll(resetFixtures);

test("a buyer picks a verified courier, who collects and delivers with the PIN", async ({ page, browser }) => {
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill("Compradora Recolectora");
  await page.getByLabel("Link de tu perfil de Facebook").fill("facebook.com/compradora.recolectora");
  await page.getByLabel("Número de celular").fill(BUYER_PHONE);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/cuenta$/, { timeout: 20_000 });

  await page.goto(`/prendas/${PRODUCT_SLUG}`);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("link", { name: /En tu carrito/ })).toBeVisible();

  await page.goto("/carrito");
  await page.getByRole("radio", { name: /Recolectora verificada/ }).check();
  await page.getByLabel("Tu municipio", { exact: true }).selectOption("Apodaca");
  await expect(page.getByText("Ninguna recolectora cubre Apodaca")).toBeVisible();
  await page.getByLabel("Tu municipio", { exact: true }).selectOption("Monterrey");
  await page.getByRole("radio", { name: /Lupita Recolectora/ }).check();
  await page.getByRole("radio", { name: "Incluida en mi anticipo a la vendedora" }).check();
  await page.getByLabel("Dirección de entrega").fill("Calle Hidalgo 123, Centro, Monterrey");
  page.once("dialog", (dialog) => dialog.accept());
  // 20% of $650 = $130, plus the $45 courier fee carried in the deposit.
  await page.getByRole("button", { name: /Apartar · anticipo \$175\.00 MXN/ }).click();
  await expect(page).toHaveURL(/\/cuenta/);
  await expect(page.getByText(/Recolectora ✓ Lupita Recolectora/)).toBeVisible();

  const sellerContext = await browser.newContext();
  const seller = await sellerContext.newPage();
  await login(seller, SELLER_PHONE, /\/panel$/);
  await seller.goto("/panel/apartados");
  const sellerCard = seller.getByRole("listitem").filter({ hasText: "Compradora Recolectora" }).first();
  await expect(sellerCard.getByText(/Recolectora Lupita Recolectora la recoge/)).toBeVisible();
  seller.once("dialog", (dialog) => dialog.accept());
  await sellerCard.getByRole("button", { name: "Confirmar anticipo" }).click();
  await expect(sellerCard.getByText("Anticipo confirmado")).toBeVisible();
  await sellerContext.close();

  const courierContext = await browser.newContext();
  const courier = await courierContext.newPage();
  await login(courier, COURIER_PHONE, /\/recolectora$/);
  const job = courier.getByRole("listitem").filter({ hasText: "Compradora Recolectora" }).first();
  await job.getByRole("button", { name: "Ya la recogí" }).click();
  await expect(job.getByText("Contigo")).toBeVisible();
  await job.getByRole("button", { name: "En camino" }).click();
  await expect(job.getByText("En camino", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator('[aria-current="step"]').filter({ hasText: "En camino" })).toBeVisible();
  const pin = (await page.getByLabel(/Código de entrega/).textContent())?.trim() ?? "";
  expect(pin).toMatch(/^\d{4}$/);

  await job.getByLabel("Código de entrega").fill(pin);
  await job.getByRole("button", { name: "Marcar entregada" }).click();
  await expect(courier.getByText("No tienes entregas por ahora.", { exact: false })).toBeVisible({ timeout: 15_000 });
  await courierContext.close();

  await page.reload();
  await page.getByRole("button", { name: "5 de 5 estrellas" }).click();
  await expect(page.getByText("Calificaste a la recolectora con 5 ★")).toBeVisible();
});
