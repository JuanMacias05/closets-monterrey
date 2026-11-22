import { expect, test, type Page } from "@playwright/test";

async function loginAsSeller(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill("+528100000002");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test("seller creates, manages photos, sells, restores and deletes her product", async ({ page, request }) => {
  const uploadedObjectPaths: string[] = [];
  page.on("request", (request) => {
    const marker = "/object/product-images/";
    const objectPathStart = request.url().indexOf(marker);
    if (request.method() === "POST" && objectPathStart >= 0) {
      uploadedObjectPaths.push(request.url().slice(objectPathStart + marker.length));
    }
  });

  await loginAsSeller(page);
  await page.goto("/panel/prendas");
  // The page's own button; the side menu has a "Subir prenda" entry too.
  await page.getByRole("main").getByRole("link", { name: "Subir prenda", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Prenda de prueba E2E");
  await page.getByLabel("Descripción").fill("Descripción para probar la ficha de producto.");
  await page.getByLabel("Categoría", { exact: true }).selectOption("tops");
  await page.getByLabel("Talla").selectOption("M");
  await page.getByLabel("Condición").selectOption("like_new");
  await page.getByLabel("Precio (MXN)").fill("350.00");
  // No photos picked: the button says so, and the garment is saved as a draft.
  await page.getByRole("button", { name: "Guardar como borrador" }).click();
  await expect(page).toHaveURL(/\/panel\/prendas\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Fotos" })).toBeVisible();
  // No photo yet: the garment is a draft and stays out of the catalog.
  await expect(page.getByText("Borrador: tu prenda se publica en cuanto le subas al menos una foto.")).toBeVisible();

  await page.locator("#product-photos").setInputFiles([
    "e2e/fixtures/store-photo-800x600.jpg",
    "e2e/fixtures/store-photo.png",
  ]);
  await expect(page.getByText("Fotos agregadas.")).toBeVisible();
  await expect(page.getByText("Publicada en el catálogo.")).toBeVisible();
  expect(uploadedObjectPaths).toHaveLength(2);
  const storageBaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321").replace(/\/$/, "");
  const publicPhotoUrls = uploadedObjectPaths.map((path) =>
    `${storageBaseUrl}/storage/v1/object/public/product-images/${path}`,
  );
  for (const url of publicPhotoUrls) expect((await request.get(url)).status()).toBe(200);
  await expect(page.getByText("Principal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hacer principal" }).click();
  await expect(page.getByRole("button", { name: "Subir foto 2" })).toBeVisible();
  await page.getByRole("button", { name: "Borrar", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Hacer principal" })).toHaveCount(0);
  const remainingPhotoStatuses = await Promise.all(publicPhotoUrls.map(async (url) => (await request.get(url)).status()));
  expect(remainingPhotoStatuses.filter((status) => status === 200)).toHaveLength(1);

  await page.goto("/panel/prendas");
  const product = page.locator("li").filter({ hasText: "Prenda de prueba E2E" });
  await expect(product).toContainText("Disponible");
  await product.getByRole("button", { name: "Marcar como vendida" }).click();
  await expect(product).toContainText("Vendida");
  await product.getByRole("button", { name: "Volver a disponible" }).click();
  await expect(product).toContainText("Disponible");

  await product.getByRole("link", { name: "Editar Prenda de prueba E2E" }).click();
  await page.getByLabel("Descripción").fill("Descripción actualizada.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Borrar prenda y fotos" }).click();
  await expect(page).toHaveURL(/\/panel\/prendas$/);
  await expect(page.getByText("Prenda de prueba E2E", { exact: true })).toHaveCount(0);
  for (const url of publicPhotoUrls) expect((await request.get(url)).ok()).toBe(false);
});

// Photos are picked on the same screen as the details and go up right after the garment is
// created, so it's published in one step instead of being saved first as a draft.
test("seller publishes a new garment with its photos in one step", async ({ page }) => {
  await loginAsSeller(page);
  await page.goto("/panel/prendas/nueva");
  await expect(page.getByText(/Entregas \(para todas tus prendas\)/)).toBeVisible();
  // How buyers pay is store-wide too; the line says what's set and links to Editar tienda.
  await expect(page.getByText("transferencia (CLABE ••••0000)")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cambiar" })).toHaveAttribute("href", "/panel/tienda");
  await page.locator("#product-photos").setInputFiles(["e2e/fixtures/store-photo-800x600.jpg", "e2e/fixtures/store-photo.png"]);
  await expect(page.getByAltText(/Foto \d por subir/)).toHaveCount(2);
  await page.getByRole("button", { name: "Quitar" }).last().click();
  await expect(page.getByAltText(/Foto \d por subir/)).toHaveCount(1);
  await page.getByLabel("Nombre", { exact: true }).fill("Prenda con foto E2E");
  await page.getByLabel("Precio (MXN)").fill("420");
  await page.getByRole("button", { name: "Publicar prenda" }).click();
  await expect(page).toHaveURL(/\/panel\/prendas\/[0-9a-f-]+$/);
  await expect(page.getByText("Publicada en el catálogo.")).toBeVisible();
  await expect(page.getByText("Principal", { exact: true })).toBeVisible();

  // Sharing: desktop Chromium has no share sheet, so the link is copied instead. Pinned off
  // here so the test does not depend on the platform's navigator.share.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  await page.goto("/panel/prendas");
  const row = page.getByRole("listitem").filter({ hasText: "Prenda con foto E2E" });
  await row.getByRole("button", { name: "Compartir" }).click();
  await expect(row.getByText("Liga copiada. Pégala en WhatsApp o Facebook.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/prendas\/prenda-con-foto-e2e/);
  await row.getByRole("link", { name: "Prenda con foto E2E", exact: true }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Borrar prenda y fotos" }).click();
  await expect(page).toHaveURL(/\/panel\/prendas$/);
});

test("the panel home offers the seller her store link to share", async ({ page }) => {
  await loginAsSeller(page);
  await expect(page.getByRole("link", { name: "Ver mi tienda" })).toHaveAttribute("href", /^\/tiendas\/[a-z0-9-]+$/);
  await expect(page.getByRole("button", { name: "Compartir mi tienda" })).toBeVisible();
});
