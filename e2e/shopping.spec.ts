import { expect, test, type Page } from "@playwright/test";

// Reserved in supabase/config.toml [auth.sms.test_otp]; no seeded account uses it.
const BUYER_PHONE = "+528100000008";
const SELLER_PHONE = "+528100000001"; // Closet de Renata: CLABE, Padre Mier/Cuauhtémoc and home delivery
const SELLER_ID = "10000000-0000-4000-8000-000000000001";
const ADMIN_PHONE = "+528100000004";
const OXXO_CARD = "4111111111111111"; // test card number with a valid check digit
const PRODUCT_ID = "20000000-0000-4000-8000-000000000003"; // Jeans rectos azul medio, $420
const PRODUCT_SLUG = "jeans-rectos-azul";
const PRODUCT_NAME = "Jeans rectos azul medio";
const WRONG_PIN_ERROR = "Ese código no coincide. Pídeselo de nuevo a tu cliente.";
const SERVER_ACTION_TIMEOUT = 15_000;

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
  // A run that failed mid-way leaves the garment held by an open reservation; drop the hold
  // so the next run can reserve it again.
  await fetch(`${url}/rest/v1/reservation_items?product_id=eq.${PRODUCT_ID}&active=eq.true`, { method: "PATCH", headers, body: JSON.stringify({ active: false }) });
  await fetch(`${url}/rest/v1/products?id=eq.${PRODUCT_ID}`, {
    method: "PATCH", headers, body: JSON.stringify({ sale_status: "available", reserved_at: null, sold_at: null }),
  });
}

// The seller accepts cash at OXXO only during this spec, so other specs see her as seeded.
async function setSellerOxxoCard(card: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  await fetch(`${url}/rest/v1/seller_private_settings?seller_id=eq.${SELLER_ID}`, {
    method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ oxxo_card: card }),
  });
}

async function signIn(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(phone);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await enterCode(page);
  await expect(page).toHaveURL(/\/panel$/, { timeout: 20_000 });
}

async function enterCode(page: Page) {
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
}

// Long flows across two browsers; the dev server compiles each new page on first visit.
test.setTimeout(120_000);

test.beforeAll(async () => { await resetFixtures(); await setSellerOxxoCard(OXXO_CARD); });
test.afterAll(async () => { await resetFixtures(); await setSellerOxxoCard(null); });

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
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page).toHaveURL(new RegExp(`/prendas/${PRODUCT_SLUG}$`));

  await page.getByRole("button", { name: `Agregar ${PRODUCT_NAME} a favoritos` }).click();
  await expect(page.getByRole("button", { name: `Quitar ${PRODUCT_NAME} de favoritos` })).toBeVisible();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("link", { name: /En tu carrito/ })).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  await page.goto("/favoritos");
  await expect(page.getByText(PRODUCT_NAME)).toBeVisible();

  await page.goto("/carrito");
  await expect(page.getByRole("heading", { name: "Closet de Renata" })).toBeVisible();
  // Three steps: her garments, how she gets them (no courier: a fixed point), the deposit.
  await page.getByRole("button", { name: "Elegir entrega" }).click();
  await expect(page.getByRole("radio", { name: "No, gracias" })).toBeChecked();
  await page.getByRole("radio", { name: /Estación Padre Mier/ }).check();
  await page.getByRole("button", { name: "Continuar al anticipo" }).click();
  await expect(page.getByText("Entrega: Punto fijo · Estación Padre Mier")).toBeVisible();
  await page.getByRole("button", { name: /Apartar · anticipo \$84\.00 MXN/ }).click();
  await expect(page).toHaveURL(/\/cuenta/);
  await expect(page.getByText("Esperando anticipo")).toBeVisible();
  await expect(page.getByText("000000000000000000")).toBeVisible();
  await expect(page.getByText("Punto fijo · Estación Padre Mier")).toBeVisible();
  // The seller gets no automatic notice; the buyer's prefilled WhatsApp message is how she learns.
  const notice = decodeURIComponent((await page.getByRole("link", { name: "Avisarle por WhatsApp" }).getAttribute("href")) ?? "");
  expect(notice).toMatch(/^https:\/\/wa\.me\/528100000001\?text=/);
  expect(notice).toContain("soy Compradora Prueba");
  expect(notice).toContain(PRODUCT_NAME);
  expect(notice).toContain("Anticipo: $84.00 MXN. Entrega: Estación Padre Mier.");

  // She pays in cash at OXXO, to the seller's card, and uploads the ticket.
  await page.getByRole("button", { name: "Efectivo en OXXO" }).click();
  await expect(page.getByText("4111 1111 1111 1111")).toBeVisible();
  await page.locator('input[type="file"][id^="proof-"]').setInputFiles("e2e/fixtures/store-photo.png");
  await page.getByLabel("Folio del ticket (opcional)").fill("4718203");
  await page.getByRole("button", { name: "Enviar ticket" }).click();
  await expect(page.getByText(/Enviaste tu ticket de OXXO el/)).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await expect(page.getByRole("img", { name: "Tu comprobante" })).toBeVisible();

  // The seller sees the ticket to review and rejects it.
  const sellerContext = await browser.newContext();
  const seller = await sellerContext.newPage();
  await signIn(seller, SELLER_PHONE);
  await seller.goto("/panel/apartados");
  const card = seller.getByRole("listitem").filter({ hasText: "Compradora Prueba" }).first();
  await expect(card.getByText("Sin historial")).toBeVisible();
  await expect(card.getByText("Revisar comprobante", { exact: true })).toBeVisible();
  await expect(card.getByText("Pagó en efectivo en OXXO")).toBeVisible();
  await expect(card.getByText("4718203")).toBeVisible();
  await expect(card.getByRole("img", { name: "Comprobante de Compradora Prueba" })).toBeVisible();
  await card.getByRole("button", { name: "Rechazar comprobante" }).click();
  await card.getByRole("button", { name: "La foto no se lee" }).click();
  await card.getByRole("button", { name: "Rechazar", exact: true }).click();
  await expect(card.getByText(/Rechazaste su comprobante: “La foto no se lee”/)).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  // The buyer sees why, asks support for help and uploads a transfer receipt instead.
  await page.reload();
  await expect(page.getByText(/no pudo confirmar tu pago/)).toBeVisible();
  await expect(page.getByText("“La foto no se lee”", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Pedir ayuda" }).click();
  await page.getByLabel("Cuéntanos qué pasó").fill("Sí deposité en OXXO y tengo mi ticket.");
  await page.getByRole("button", { name: "Enviar a soporte" }).click();
  await expect(page.getByText("Tu solicitud de ayuda está abierta.")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  // The request reaches the admin's support inbox.
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signIn(admin, ADMIN_PHONE);
  await admin.goto("/panel/admin/soporte");
  const request = admin.getByRole("listitem").filter({ hasText: "Sí deposité en OXXO y tengo mi ticket." }).first();
  await expect(request.getByText("Le rechazaron su comprobante")).toBeVisible();
  await expect(request.getByText(/Rechazado: .* “La foto no se lee”/)).toBeVisible();
  await request.getByRole("button", { name: "Marcar resuelta" }).click();
  await expect(admin.getByText("Sí deposité en OXXO y tengo mi ticket.")).toBeHidden({ timeout: SERVER_ACTION_TIMEOUT });
  await adminContext.close();

  await page.getByRole("button", { name: "Transferencia" }).click();
  await page.locator('input[type="file"][id^="proof-"]').setInputFiles("e2e/fixtures/store-photo-800x600.jpg");
  await page.getByLabel("Clave de rastreo (opcional)").fill("MBAN0100261119002");
  await page.getByRole("button", { name: "Enviar comprobante" }).click();
  await expect(page.getByText(/Enviaste tu comprobante el/)).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  // The seller confirms the deposit, then the delivery.
  await seller.reload();
  await expect(card.getByText("Pagó por transferencia")).toBeVisible();
  await expect(card.getByRole("link", { name: "Verificar la transferencia en Banxico (CEP)" })).toBeVisible();
  seller.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Confirmar anticipo" }).click();
  await expect(card.getByText("Anticipo confirmado")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await card.getByRole("button", { name: "En camino" }).click();
  await expect(card.getByText(/En camino/)).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  // The buyer sees her PIN; a wrong one is refused, hers completes the delivery.
  await page.goto("/cuenta");
  await expect(page.getByRole("listitem").filter({ hasText: "En camino" }).first()).toBeVisible();
  const pin = (await page.getByLabel(/Código de entrega/).textContent())?.trim() ?? "";
  expect(pin).toMatch(/^\d{4}$/);

  await card.getByLabel("Código de entrega").fill(pin === "0000" ? "1111" : "0000");
  await card.getByRole("button", { name: "Marcar entregada" }).click();
  // Preserve exact assertions while giving Supabase-backed Server Actions time to finish
  // under a full local suite (the default Playwright expect timeout is 5 seconds).
  await expect(card.getByRole("alert")).toHaveText(WRONG_PIN_ERROR, { timeout: SERVER_ACTION_TIMEOUT });
  await card.getByLabel("Código de entrega").fill(pin);
  await card.getByRole("button", { name: "Marcar entregada" }).click();
  await expect(seller.getByText("No tienes apartados abiertos.")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  // Not "(1)": other specs delete their test buyers, and a deleted buyer's completed sale now
  // stays in the seller's history, anonymous (20261119000100_buyer_self_delete).
  await seller.getByText(/^Historial \(\d+\)$/).click();
  await expect(seller.getByRole("listitem").filter({ hasText: "Compradora Prueba" }).first().getByText("Entregada")).toBeVisible();
  await sellerContext.close();

  await page.reload();
  await expect(page.locator('[aria-current="step"]').filter({ hasText: "Entregada" })).toBeVisible();

  // Once delivered she rates the store, once (20261128000100); its page shows the average.
  const rating = page.getByRole("form", { name: "Calificar a Closet de Renata" }).first();
  await rating.getByRole("button", { name: "5 de 5 estrellas para la tienda" }).click();
  await rating.getByLabel(/Comentario/).fill("Todo perfecto, muy amable.");
  await rating.getByRole("button", { name: "Enviar calificación" }).click();
  await expect(page.getByText("Calificaste a la tienda con 5 ★").first()).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await page.goto("/tiendas/closet-de-renata");
  await expect(page.getByTestId("seller-rating")).toContainText(/★ \d\.\d · \d+ calificaci/);
});
