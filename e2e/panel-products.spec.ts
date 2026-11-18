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
  await page.getByRole("link", { name: "Agregar prenda" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Prenda de prueba E2E");
  await page.getByLabel("Descripción").fill("Descripción para probar la ficha de producto.");
  await page.getByLabel("Categoría").selectOption("tops");
  await page.getByLabel("Talla").selectOption("M");
  await page.getByLabel("Condición").selectOption("like_new");
  await page.getByLabel("Precio (MXN)").fill("350.00");
  await page.getByRole("button", { name: "Crear prenda" }).click();
  await expect(page).toHaveURL(/\/panel\/prendas\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Fotos" })).toBeVisible();

  await page.locator("#product-photos").setInputFiles([
    "e2e/fixtures/store-photo-800x600.jpg",
    "e2e/fixtures/store-photo.png",
  ]);
  await expect(page.getByText("Fotos agregadas.")).toBeVisible();
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
