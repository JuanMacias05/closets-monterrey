import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("touch opens the gallery, swipe changes photo, and Escape closes it", async ({ page }) => {
  await page.goto("/prendas/top-satin-marfil");

  const stage = page.getByTestId("product-gallery-stage");
  await stage.getByRole("button", { name: "Ampliar foto 1 de 2" }).tap();

  const dialog = page.getByRole("dialog", { name: "Foto ampliada de Top satinado marfil" });
  await expect(dialog).toBeVisible();
  const image = dialog.getByRole("img");
  await expect(image).toHaveAttribute("alt", "Top satinado marfil, vista frontal");

  const swipeArea = page.getByTestId("product-gallery-zoom-image");
  const bounds = await swipeArea.boundingBox();
  expect(bounds).not.toBeNull();
  const startX = bounds!.x + bounds!.width * 0.7;
  const endX = bounds!.x + bounds!.width * 0.3;
  const y = bounds!.y + bounds!.height * 0.5;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: endX, y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(image).toHaveAttribute("alt", "Detalle de top satinado marfil");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await cdp.detach();
});
