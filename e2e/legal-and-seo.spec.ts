import { expect, test } from "@playwright/test";

test("the privacy notice and data-deletion pages are public and linked from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Aviso de privacidad" }).click();
  await expect(page).toHaveURL(/\/privacidad$/);
  await expect(page.getByRole("heading", { name: "Aviso de privacidad", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tus derechos (ARCO)" })).toBeVisible();

  await page.goto("/borrar-datos");
  await expect(page.getByRole("heading", { name: "Borrar mis datos", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Si entraste con Facebook" })).toBeVisible();
});

test("sign-up links to the privacy notice", async ({ page }) => {
  await page.goto("/registro");
  await expect(page.getByRole("link", { name: "Aviso de privacidad" })).toHaveAttribute("href", "/privacidad");
});

test("robots keeps private areas out and the sitemap lists garment pages", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /panel");
  expect(robots).toContain("Sitemap:");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/prendas/top-satin-marfil");
});

test("an unknown page shows the site 404", async ({ page }) => {
  const response = await page.goto("/esta-pagina-no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta página no existe." })).toBeVisible();
});
