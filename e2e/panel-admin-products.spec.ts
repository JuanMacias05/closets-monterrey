import { expect, test, type Page } from "@playwright/test";

async function loginWithPhone(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(phone);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test("admin hides and restores a seller product and the seller sees its hidden status", async ({ page, browser }, testInfo) => {
  await loginWithPhone(page, "+528100000004");
  await page.goto("/panel/admin/prendas");
  const adminProduct = page.locator("li").filter({ hasText: "Top satinado marfil" });
  await expect(adminProduct).toContainText("Visible");
  await adminProduct.getByRole("button", { name: "Ocultar del catálogo" }).click();
  await expect(adminProduct).toContainText("Oculta por administración");
  await expect(adminProduct).toHaveCount(1);

  // A separate context keeps the seller's session cookies from replacing the admin's,
  // which would make the admin's "Mostrar en catálogo" click run as the seller.
  const sellerContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const sellerPage = await sellerContext.newPage();
  await loginWithPhone(sellerPage, "+528100000001");
  await sellerPage.goto("/panel/prendas");
  const sellerProduct = sellerPage.locator("li").filter({ hasText: "Top satinado marfil" });
  await expect(sellerProduct).toContainText("Oculta por administración");
  await expect(sellerProduct.getByRole("button", { name: "Ocultar del catálogo" })).toHaveCount(0);

  await adminProduct.getByRole("button", { name: "Mostrar en catálogo" }).click();
  await expect(adminProduct).toContainText("Visible");
  await sellerContext.close();
});
