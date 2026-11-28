import { expect, test } from "./fixtures";

test("login page shows the phone form without sending it", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Entra a BZRS." })).toBeVisible();
  await expect(page.getByLabel("Número de celular")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar código" })).toBeEnabled();
});

test("privacy, robots and sitemap respond", async ({ page, request }) => {
  const privacy = await page.goto("/privacidad");
  expect(privacy?.status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("<urlset");
});
