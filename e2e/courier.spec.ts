import { expect, test, type Page } from "@playwright/test";

// Couriers accept or reject (20261124000100) and everyone talks in the app's chat
// (20261125000100). Three logins in all (buyer sign-up, courier, seller): the local SMS cap is
// 30/hour for the whole suite.

// Reserved in supabase/config.toml [auth.sms.test_otp].
const BUYER_PHONE = "+528100000007";
const SELLER_PHONE = "+528100000001"; // Closet de Renata, reaches Padre Mier
const COURIER_PHONE = "+528100000006"; // Lupita Recolectora: Padre Mier -> Monterrey, $45
const PRODUCT_ID = "20000000-0000-4000-8000-000000000005"; // Vestido floral de verano, $650
const PRODUCT_SLUG = "vestido-floral";
const SERVER_ACTION_TIMEOUT = 15_000;

function adminHeaders() {
  const key = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Run through `npm run test:e2e` so the local Supabase keys are set.");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// Removes the buyer (her reservations stay, anonymous) and puts the dress back on sale, closing
// any reservation a failed run left holding it.
async function resetFixtures() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const headers = adminHeaders();
  const held = (await (await fetch(`${url}/rest/v1/reservation_items?product_id=eq.${PRODUCT_ID}&active=eq.true&select=reservation_id`, { headers })).json()) as { reservation_id: string }[];
  if (held.length) {
    const ids = held.map((row) => row.reservation_id).join(",");
    await fetch(`${url}/rest/v1/reservations?id=in.(${ids})&status=in.(pending_deposit,confirmed)`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "cancelled", closed_at: new Date().toISOString() }),
    });
    await fetch(`${url}/rest/v1/courier_requests?reservation_id=in.(${ids})&status=eq.requested`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "withdrawn", resolved_at: new Date().toISOString() }),
    });
  }
  await fetch(`${url}/rest/v1/reservation_items?product_id=eq.${PRODUCT_ID}&active=eq.true`, { method: "PATCH", headers, body: JSON.stringify({ active: false }) });
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

// From the dress's page to "Apartar y pedir recolectora" with Lupita, fee inside the deposit.
async function reserveWithLupita(page: Page) {
  await page.goto(`/prendas/${PRODUCT_SLUG}`);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("link", { name: /En tu carrito/ })).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await page.goto("/carrito");
  await page.getByRole("button", { name: "Elegir entrega" }).click();
  await page.getByRole("radio", { name: "Sí, quiero una recolectora" }).check();
  await page.getByLabel("Tu municipio", { exact: true }).selectOption("Apodaca");
  await expect(page.getByText("Ninguna recolectora cubre Apodaca")).toBeVisible();
  await page.getByLabel("Tu municipio", { exact: true }).selectOption("Monterrey");
  await page.getByRole("radio", { name: /Lupita Recolectora/ }).check();
  await page.getByRole("radio", { name: "Incluida en mi anticipo a la vendedora" }).check();
  await page.getByLabel("Dirección de entrega").fill("Calle Hidalgo 123, Centro, Monterrey");
  // 20% of $650 = $130, plus the $45 courier fee carried in the deposit.
  await expect(page.getByTestId("checkout-deposit")).toHaveText("$175.00 MXN");
  await page.getByRole("button", { name: "Continuar al anticipo" }).click();
  await expect(page.getByText(/Tiene 2 horas para aceptar/)).toBeVisible();
  await page.getByRole("button", { name: "Apartar y pedir recolectora" }).click();
  await expect(page).toHaveURL(/\/cuenta/, { timeout: SERVER_ACTION_TIMEOUT });
}

test.setTimeout(180_000);
test.beforeAll(resetFixtures);
test.afterAll(resetFixtures);

test("a courier rejects a request, accepts the next, and everyone coordinates in the chat", async ({ page, browser }) => {
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill("Compradora Recolectora");
  await page.getByLabel("Link de tu perfil de Facebook").fill("facebook.com/compradora.recolectora");
  await page.getByLabel("Número de celular").fill(BUYER_PHONE);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page).toHaveURL(/\/cuenta$/, { timeout: 20_000 });

  // 1. She asks Lupita. Until Lupita answers there is nothing to pay.
  await reserveWithLupita(page);
  await expect(page.getByText("Esperando a que Lupita Recolectora acepte").first()).toBeVisible();
  await expect(page.getByText("000000000000000000")).toHaveCount(0);

  // 2. Lupita sees the request counted in her menu and rejects it, with a reason.
  const courierContext = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const courier = await courierContext.newPage();
  await login(courier, COURIER_PHONE, /\/recolectora$/);
  // The green bar's PANEL counts the request; its "Tus entregas" column leads to it.
  await expect(courier.getByRole("button", { name: /^Panel.*1 pendientes/ })).toBeVisible();
  await courier.getByRole("button", { name: /^Panel/ }).click();
  await courier.getByRole("group", { name: "Panel" }).getByRole("link", { name: /Solicitudes \(1 por responder\)/ }).click();
  const request = courier.getByRole("listitem").filter({ hasText: "Closet de Renata → Monterrey" });
  await expect(request.getByText("Vestido floral")).toBeVisible();
  await expect(request.getByText("Compradora Recolectora")).toHaveCount(0); // no buyer details before accepting
  await request.getByRole("button", { name: "Rechazar" }).click();
  await request.getByRole("button", { name: "No paso por ahí ese día" }).click();
  await request.getByRole("button", { name: "Rechazar entrega" }).click();
  await expect(courier.getByText("No tienes solicitudes por responder.")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  // 3. The buyer sees why, can't ask Lupita again, and switches to a fixed point instead.
  await page.reload();
  await expect(page.getByText("Tu recolectora no aceptó").first()).toBeVisible();
  await expect(page.getByText(/“No paso por ahí ese día”/)).toBeVisible();
  await page.getByRole("radio", { name: "Sí, quiero una recolectora" }).check();
  await expect(page.getByText(/Ninguna recolectora disponible cubre Monterrey/)).toBeVisible();
  await page.getByRole("radio", { name: "No, gracias" }).check();
  await page.getByRole("radio", { name: /Estación Padre Mier/ }).check();
  await page.getByRole("button", { name: "Guardar entrega" }).click();
  await expect(page.getByText("Punto fijo · Estación Padre Mier")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await expect(page.getByText("000000000000000000")).toBeVisible(); // now she can pay
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar apartado" }).click();
  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  // 4. She asks Lupita again for a new apartado; this time Lupita accepts.
  await reserveWithLupita(page);
  await courier.reload();
  const second = courier.getByRole("listitem").filter({ hasText: "Closet de Renata → Monterrey" });
  await second.getByRole("button", { name: "Aceptar" }).click();
  await expect(courier.getByText("No tienes solicitudes por responder.")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  await page.reload();
  await expect(page.getByTestId("courier-notice").filter({ hasText: "Lupita Recolectora aceptó llevar tus prendas" })).toBeVisible();
  await expect(page.getByText("000000000000000000")).toBeVisible();

  // 5. The buyer writes to the seller in the chat.
  await page.getByRole("link", { name: /Mensajes con la vendedora/ }).first().click();
  // The dev server compiles each chat page on its first visit.
  await expect(page.getByRole("heading", { name: "Closet de Renata" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Escribe un mensaje").fill("Hola, ¿me confirmas cuando lo recoja Lupita?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("list", { name: "Mensajes" }).getByText("Hola, ¿me confirmas cuando lo recoja Lupita?")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  // 5b. And to her courier, with a photo of her front door (the seller is not in this chat).
  await page.goto("/cuenta");
  await page.getByRole("link", { name: /Mensajes con la recolectora/ }).first().click();
  await expect(page.getByRole("heading", { name: "Recolectora Lupita Recolectora" })).toBeVisible({ timeout: 20_000 });
  await page.locator('input[type="file"][id^="chat-photo-"]').setInputFiles("e2e/fixtures/store-photo.png");
  await expect(page.getByRole("img", { name: "Foto por enviar" })).toBeVisible();
  await page.getByLabel("Escribe un mensaje").fill("Así es mi fachada, portón verde.");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("img", { name: "Tu foto" })).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await page.goto("/cuenta/mensajes");
  await page.getByRole("link", { name: /Closet de Renata/ }).first().click();

  // 6. The seller sees who takes it and the unread message, answers live, confirms the deposit.
  const sellerContext = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const seller = await sellerContext.newPage();
  await login(seller, SELLER_PHONE, /\/panel$/);
  // One inbox: the unread count is on MI CUENTA ▾ › Mensajes.
  await seller.getByRole("button", { name: /Mi cuenta/ }).click();
  await expect(seller.getByRole("group", { name: "Mi cuenta" }).getByRole("link", { name: /Mensajes \(1 mensaje sin leer\)/ })).toBeVisible();
  await seller.goto("/panel/apartados");
  const card = seller.getByRole("listitem").filter({ hasText: "Compradora Recolectora" }).filter({ hasText: "Esperando anticipo" }).first();
  await expect(card.getByTestId("courier-status")).toHaveText("✓ Lupita Recolectora aceptó la entrega.");
  await card.getByRole("link", { name: /Mensajes con Compradora Recolectora/ }).click();
  await expect(seller.getByText("Hola, ¿me confirmas cuando lo recoja Lupita?")).toBeVisible({ timeout: 20_000 });
  await seller.getByLabel("Escribe un mensaje").fill("¡Claro! Te aviso por aquí.");
  await seller.getByRole("button", { name: "Enviar" }).click();
  // Realtime: the buyer's open chat shows it without reloading.
  await expect(page.getByText("¡Claro! Te aviso por aquí.")).toBeVisible({ timeout: 20_000 });

  await seller.goto("/panel/apartados");
  seller.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Confirmar anticipo" }).click();
  const confirmed = seller.getByRole("listitem").filter({ hasText: "Compradora Recolectora" }).filter({ hasText: "Anticipo confirmado" }).first();
  await expect(confirmed).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await confirmed.getByRole("link", { name: /Mensajes con la recolectora/ }).click();
  await seller.getByLabel("Escribe un mensaje").fill("Lupita, te espero en Padre Mier a las 6.");
  await seller.getByRole("button", { name: "Enviar" }).click();
  await expect(seller.getByRole("list", { name: "Mensajes" }).getByText("Lupita, te espero en Padre Mier a las 6.")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await sellerContext.close();

  // 7. Lupita reads the seller and the buyer (with her photo), collects and delivers with the PIN.
  await courier.goto("/recolectora");
  const job = courier.getByRole("listitem").filter({ hasText: "Compradora Recolectora" }).first();
  await job.getByRole("link", { name: /Mensajes con la clienta/ }).click();
  await expect(courier.getByText("Así es mi fachada, portón verde.")).toBeVisible({ timeout: 20_000 });
  await courier.getByRole("button", { name: "Ver foto de compradora recolectora en grande" }).click();
  const enlarged = courier.getByRole("dialog", { name: "Foto de Compradora Recolectora" });
  await expect(enlarged.getByRole("img")).toBeVisible();
  await courier.keyboard.press("Escape");
  await expect(enlarged).toHaveCount(0);
  await courier.goto("/recolectora");
  await job.getByRole("link", { name: /Mensajes con la vendedora/ }).click();
  await expect(courier.getByText("Lupita, te espero en Padre Mier a las 6.")).toBeVisible({ timeout: 20_000 });
  await courier.goto("/recolectora");
  await job.getByRole("button", { name: "Ya la recogí" }).click();
  await expect(job.getByText("Contigo")).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await job.getByRole("button", { name: "En camino" }).click();
  await expect(job.getByText("En camino", { exact: true })).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });

  await page.goto("/cuenta");
  const pin = (await page.getByLabel(/Código de entrega/).textContent())?.trim() ?? "";
  expect(pin).toMatch(/^\d{4}$/);
  await job.getByLabel("Código de entrega").fill(pin);
  await job.getByRole("button", { name: "Marcar entregada" }).click();
  await expect(courier.getByText("No tienes entregas por ahora.", { exact: false })).toBeVisible({ timeout: SERVER_ACTION_TIMEOUT });
  await courierContext.close();

  await page.reload();
  await page.getByRole("button", { name: "5 de 5 estrellas" }).click();
  await expect(page.getByText("Calificaste a la recolectora con 5 ★")).toBeVisible();
});
