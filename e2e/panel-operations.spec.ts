import { expect, test, type Page } from "@playwright/test";

// Panel operations: the courier directory's approval gate and the quick price edit.
const ADMIN_PHONE = "8100000004";
const SELLER_PHONE = "8100000001"; // Closet de Renata

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(phone);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test("a courier only shows publicly while an admin has her verified", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, ADMIN_PHONE);
  await page.goto("/panel/admin/recolectoras");
  const row = page.getByRole("listitem").filter({ hasText: "Lupita Recolectora" });

  await row.getByRole("button", { name: "Suspender" }).click();
  await expect(row.getByRole("button", { name: "Verificar" })).toBeVisible();
  try {
    await page.goto("/recolectoras");
    await expect(page.getByText("Lupita Recolectora")).toHaveCount(0);
  } finally {
    // Restore the seed state even if the check above failed: other specs rely on Lupita.
    await page.goto("/panel/admin/recolectoras");
    await row.getByRole("button", { name: "Verificar" }).click();
    await expect(row.getByRole("button", { name: "Suspender" })).toBeVisible();
  }
  await page.goto("/recolectoras");
  await expect(page.getByText("Lupita Recolectora").first()).toBeVisible();
});

test("a seller changes a garment's price from her list", async ({ page }) => {
  await login(page, SELLER_PHONE);

  await page.goto("/panel/prendas");
  const change = page.getByRole("button", { name: /^Cambiar precio de / }).first();
  const productName = ((await change.getAttribute("aria-label")) ?? "").replace("Cambiar precio de ", "");
  // Matched by the name link, which stays while the price button turns into the form.
  const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: productName, exact: true }) });
  const priceText = ((await row.textContent()) ?? "").match(/\$([\d,]+\.\d{2}) MXN/)?.[1];
  const original = priceText?.replace(/,/g, "");
  expect(original).toBeTruthy();

  async function setPrice(value: string) {
    await row.getByRole("button", { name: `Cambiar precio de ${productName}` }).click();
    await page.getByLabel(`Nuevo precio de ${productName} en pesos`).fill(value);
    await row.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByLabel(`Nuevo precio de ${productName} en pesos`)).toHaveCount(0);
  }

  await setPrice("123.00");
  await expect(row.getByText("$123.00 MXN")).toBeVisible();
  await setPrice(original!);
  await expect(row.getByText(`$${priceText} MXN`)).toBeVisible();
});
