import { expect, test, type Page } from "@playwright/test";

// Reserved in supabase/config.toml [auth.sms.test_otp]; no seeded account uses it.
const BUYER_PHONE = "+528100000008";
const SELLER_PHONE = "+528100000001"; // Closet de Renata: CLABE, Padre Mier/Cuauhtémoc and home delivery
const PRODUCT_ID = "20000000-0000-4000-8000-000000000003"; // Jeans rectos azul medio, $420
const PRODUCT_SLUG = "jeans-rectos-azul";
const PRODUCT_NAME = "Jeans rectos azul medio";

function adminHeaders() {
  const key = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Run through `npm run test:e2e` so the local Supabase keys are set.");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// Deleting the buyer cascades to her favorites, cart and reservations; the product is then
// put back on sale so the spec can run again.
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

async function enterCode(page: Page) {
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
}

// Long flows across two browsers; the dev server compiles each new page on first visit.
test.setTimeout(120_000);

test.beforeAll(resetFixtures);
test.afterAll(resetFixtures);

test("a shopper saves a favorite, reserves from her cart and the seller completes the sale", async ({ page, browser }) => {
  // Browsing is open; saving asks for an account and comes back to the product.
  await page.goto(`/prendas/${PRODUCT_SLUG}`);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole("link", { name: "Crear cuenta", exact: true }).click();

  await page.getByLabel("Tu nombre").fill("Compradora Prueba");
  await page.getByLabel("Link de tu perfil de Facebook").fill("facebook.com/compradora.prueba");
  await page.getByLabel("Número de celular").fill(BUYER_PHONE);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await enterCode(page);
  await expect(page).toHaveURL(new RegExp(`/prendas/${PRODUCT_SLUG}$`));

  await page.getByRole("button", { name: `Agregar ${PRODUCT_NAME} a favoritos` }).click();
  await expect(page.getByRole("button", { name: `Quitar ${PRODUCT_NAME} de favoritos` })).toBeVisible();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("link", { name: /En tu carrito/ })).toBeVisible();

  await page.goto("/favoritos");
  await expect(page.getByText(PRODUCT_NAME)).toBeVisible();

  await page.goto("/carrito");
  await expect(page.getByRole("heading", { name: "Closet de Renata" })).toBeVisible();
  await page.getByRole("radio", { name: /Estación Padre Mier/ }).check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Apartar · anticipo \$84\.00 MXN/ }).click();
  await expect(page).toHaveURL(/\/cuenta/);
  await expect(page.getByText("Esperando anticipo")).toBeVisible();
  await expect(page.getByText("000000000000000000")).toBeVisible();
  await expect(page.getByText("Punto fijo · Estación Padre Mier")).toBeVisible();

  // The seller confirms the deposit, then the delivery.
  const sellerContext = await browser.newContext();
  const seller = await sellerContext.newPage();
  await seller.goto("/login");
  await seller.getByLabel("Número de celular").fill(SELLER_PHONE);
  await seller.getByRole("button", { name: "Enviar código" }).click();
  await enterCode(seller);
  await expect(seller).toHaveURL(/\/panel$/, { timeout: 20_000 });
  await seller.goto("/panel/apartados");
  const card = seller.getByRole("listitem").filter({ hasText: "Compradora Prueba" }).first();
  await expect(card.getByText("Sin historial")).toBeVisible();
  seller.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Confirmar anticipo" }).click();
  await expect(card.getByText("Anticipo confirmado")).toBeVisible();
  await card.getByRole("button", { name: "En camino" }).click();
  await expect(card.getByText(/En camino/)).toBeVisible();

  // The buyer sees her PIN; a wrong one is refused, hers completes the delivery.
  await page.goto("/cuenta");
  await expect(page.getByRole("listitem").filter({ hasText: "En camino" }).first()).toBeVisible();
  const pin = (await page.getByLabel(/Código de entrega/).textContent())?.trim() ?? "";
  expect(pin).toMatch(/^\d{4}$/);

  await card.getByLabel("Código de entrega").fill(pin === "0000" ? "1111" : "0000");
  await card.getByRole("button", { name: "Marcar entregada" }).click();
  await expect(card.getByText("Ese código no coincide.", { exact: false })).toBeVisible();
  await card.getByLabel("Código de entrega").fill(pin);
  await card.getByRole("button", { name: "Marcar entregada" }).click();
  await expect(seller.getByText("No tienes apartados abiertos.")).toBeVisible();
  await seller.getByText(/^Historial \(1\)$/).click();
  await expect(seller.getByRole("listitem").filter({ hasText: "Compradora Prueba" }).getByText("Entregada")).toBeVisible();
  await sellerContext.close();

  await page.reload();
  await expect(page.locator('[aria-current="step"]').filter({ hasText: "Entregada" })).toBeVisible();
});
