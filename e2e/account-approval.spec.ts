import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// One account, several activities (20261127000100). Reserved in supabase/config.toml
// [auth.sms.test_otp] and used by no seeded account: 9 signs up, 10 is added by the admin.
const NEW_SELLER_PHONE = "+528100000009";
const ADDED_COURIER_PHONE = "+528100000010";
const ADMIN_PHONE = "+528100000004";

function adminHeaders() {
  const key = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Run through `npm run test:e2e` so the local Supabase keys are set.");
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function deleteAccountByPhone(phone: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const headers = adminHeaders();
  const response = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers });
  const { users } = (await response.json()) as { users: { id: string; phone?: string }[] };
  const existing = users.find((user) => user.phone === phone.replace("+", ""));
  if (!existing) return;
  // Her store and courier rows go with the user (cascade); products she never had.
  await fetch(`${url}/auth/v1/admin/users/${existing.id}`, { method: "DELETE", headers });
}

async function login(page: Page, phone: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(phone);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(landing, { timeout: 20_000 });
}

async function openPanel(page: Page) {
  await page.getByRole("button", { name: /^Panel/ }).click();
  return page.getByRole("group", { name: "Panel" });
}

// Long flows across two browsers; the dev server compiles each new page on first visit.
test.setTimeout(150_000);

// One admin login shared by both flows: every login sends an SMS, and the local stack allows
// 30 an hour for the whole suite.
test.describe.configure({ mode: "serial" });
let adminContext: BrowserContext;
let admin: Page;

test.beforeAll(async ({ browser }) => {
  await deleteAccountByPhone(NEW_SELLER_PHONE);
  await deleteAccountByPhone(ADDED_COURIER_PHONE);
  adminContext = await browser.newContext();
  admin = await adminContext.newPage();
  await login(admin, ADMIN_PHONE, /\/panel$/);
});
test.afterAll(async () => {
  await adminContext?.close();
  await deleteAccountByPhone(ADDED_COURIER_PHONE);
});

test("she signs up to sell and deliver, waits for review, and gets both columns once approved", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Crear cuenta" }).click();
  await page.getByLabel("Tu nombre").fill("Vendedora Recolectora");
  await page.getByLabel("Link de tu perfil de Facebook").fill("facebook.com/vendedora.recolectora");
  await page.getByLabel("Número de celular").fill(NEW_SELLER_PHONE);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();

  // After the code, one question with checkboxes; buying is always on.
  await expect(page.getByText("¿Qué quieres hacer en Closets?")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Comprar/ })).toBeDisabled();
  await page.getByRole("checkbox", { name: /Vender mis prendas/ }).check();
  await page.getByLabel("Nombre de tu clóset").fill("Closet de Prueba Registro");
  await page.getByRole("checkbox", { name: /Entregar pedidos/ }).check();
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Tu cuenta está en revisión." })).toBeVisible({ timeout: 20_000 });
  let menu = await openPanel(page);
  await expect(menu.getByText(/Tu clóset está en revisión/)).toBeVisible();
  await expect(menu.getByText(/Falta tu verificación/)).toBeVisible();

  // The admin approves her store and verifies her as a courier.
  await admin.goto("/panel/admin/vendedoras");
  const row = admin.getByRole("listitem").filter({ hasText: "Closet de Prueba Registro" });
  await expect(row.getByText("En revisión")).toBeVisible();
  await expect(row.getByText("Se registró sola")).toBeVisible();
  await expect(row.getByText("También entrega")).toBeVisible();
  await row.getByRole("button", { name: "Aprobar" }).click();
  await expect(row.getByText("Aprobada")).toBeVisible();
  // The admin's own row never offers to suspend her store.
  await expect(admin.getByRole("listitem").filter({ hasText: "(tú)" }).getByRole("button", { name: "Suspender" })).toHaveCount(0);
  await admin.goto("/panel/admin/recolectoras");
  const courierRow = admin.getByRole("listitem").filter({ hasText: "Vendedora Recolectora" });
  admin.once("dialog", (dialog) => dialog.accept());
  await courierRow.getByRole("button", { name: "Verificar" }).click();
  await expect(courierRow.getByText("Verificada")).toBeVisible();

  // Seller + courier: both columns, and still no admin.
  await page.reload();
  menu = await openPanel(page);
  await expect(menu.getByRole("link", { name: "Mis prendas" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Solicitudes" })).toBeVisible();
  await expect(menu.getByText("Administración del sitio")).toHaveCount(0);
});

test("an admin adds a courier by phone, who logs in already verified and sees only her deliveries", async ({ page }) => {
  await admin.goto("/panel/admin/recolectoras");
  await admin.getByRole("button", { name: "+ Agregar persona" }).click();
  const form = admin.getByRole("form", { name: "Agregar persona" });
  await form.getByLabel("Teléfono").fill(ADDED_COURIER_PHONE.replace("+52", ""));
  await form.getByLabel("Nombre", { exact: true }).fill("Repartidora Agregada");
  await expect(form.getByRole("checkbox", { name: "Entregar" })).toBeChecked();
  await form.getByRole("button", { name: "Agregar" }).click();
  await expect(form.getByText(/Repartidora Agregada ya puede entrar/)).toBeVisible({ timeout: 20_000 });
  const row = admin.getByRole("listitem").filter({ hasText: "Repartidora Agregada" });
  await expect(row.getByText("Verificada")).toBeVisible();
  await expect(row.getByText("Agregada por admin")).toBeVisible();

  // She logs in with her phone: verified, only "Tus entregas".
  await login(page, ADDED_COURIER_PHONE, /\/recolectora$/);
  const menu = await openPanel(page);
  await expect(menu.getByText("Tus entregas", { exact: true })).toBeVisible();
  await expect(menu.getByText("Tu clóset", { exact: true })).toHaveCount(0);
  await expect(menu.getByText("Administración del sitio")).toHaveCount(0);
  await expect(menu.getByText(/Falta tu verificación/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Mi cuenta/ }).click();
  const account = page.getByRole("group", { name: "Mi cuenta" });
  await expect(account.getByRole("link", { name: "Quiero vender" })).toBeVisible();
  await expect(account.getByRole("link", { name: "Quiero entregar" })).toHaveCount(0);
});

test("login refuses a number with no account and points to sign-up", async ({ page }) => {
  await deleteAccountByPhone(NEW_SELLER_PHONE);
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(NEW_SELLER_PHONE);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByText("Si aún no tienes cuenta, créala primero.")).toBeVisible();
});
