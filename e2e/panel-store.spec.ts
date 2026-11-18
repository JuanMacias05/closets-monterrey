import { expect, test, type Page } from "@playwright/test";

async function loginWithTestPhone(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(phone);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test("legacy seller and admin URLs permanently redirect to panel routes", async ({ request }) => {
  const redirects = [
    ["/vendedor/perfil", "/panel/tienda"],
    ["/vendedor/prendas/nueva", "/panel/prendas/nueva"],
    ["/vendedor/prendas/sku-de-prueba", "/panel/prendas/sku-de-prueba"],
    ["/vendedor/prendas", "/panel/prendas"],
    ["/vendedor", "/panel"],
    ["/admin/prendas", "/panel/admin/prendas"],
    ["/admin/vendedoras/seller-id", "/panel"],
  ];

  for (const [source, destination] of redirects) {
    const response = await request.get(source, { maxRedirects: 0 });
    expect(response.status(), source).toBe(308);
    expect(response.headers().location, source).toBe(destination);
  }
});

test("admin can update her own store name, WhatsApp and valid CLABE", async ({ page }) => {
  await loginWithTestPhone(page, "+528100000004");
  await page.goto("/panel/tienda");

  await page.locator("#store-avatar").setInputFiles("e2e/fixtures/store-photo-800x600.jpg");
  await page.getByLabel("Nombre de la tienda").fill("Closet admin de prueba");
  await page.getByLabel("WhatsApp").fill("81 1234 5678");
  await page.getByLabel("CLABE para recibir pagos").fill("000000000000000000");
  await page.getByRole("button", { name: "Guardar tienda" }).click();
  await expect(page.getByRole("status")).toHaveText("Tienda guardada.");
  await expect(page.getByAltText("Foto de Closet admin de prueba")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nombre de la tienda")).toHaveValue("Closet admin de prueba");
  await expect(page.getByLabel("WhatsApp")).toHaveValue("+528112345678");
  await expect(page.getByLabel("CLABE para recibir pagos")).toHaveValue("000000000000000000");

  await page.locator("#store-avatar").setInputFiles("e2e/fixtures/store-photo.png");
  await page.getByRole("button", { name: "Guardar tienda" }).click();
  await expect(page.getByRole("status")).toHaveText("Tienda guardada.");
});

test("store settings reject a CLABE with an invalid check digit", async ({ page }) => {
  await loginWithTestPhone(page, "+528100000001");
  await page.goto("/panel/tienda");
  await page.getByLabel("CLABE para recibir pagos").fill("000000000000000001");
  await page.getByRole("button", { name: "Guardar tienda" }).click();
  await expect(page.getByText("La CLABE debe tener 18 dígitos y un dígito verificador válido.", { exact: true })).toBeVisible();
});
