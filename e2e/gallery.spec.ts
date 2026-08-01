import { expect, test } from "@playwright/test";
import { collectConsoleErrors, collectFailedRequests, contentFiles } from "./utils";

test.describe("gallery and lightbox", () => {
  test("grid renders every gallery image", async ({ page }) => {
    const failed = collectFailedRequests(page);
    const photos = contentFiles("gallery");
    test.skip(photos.length === 0, "no gallery entries");

    await page.goto("/bildegalleri/");

    const imgs = page.locator('main img[src*="/images/"]');
    await expect(imgs).toHaveCount(photos.length, { timeout: 10_000 });

    // lazy-loaded images settle asynchronously — poll until all decoded
    await expect
      .poll(
        () =>
          imgs.evaluateAll((els) =>
            els.every((el) => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0)
          ),
        { timeout: 15_000 }
      )
      .toBe(true);
    expect(failed).toEqual([]);
  });

  test("lightbox opens, navigates and closes", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const photos = contentFiles("gallery");
    test.skip(photos.length === 0, "no gallery entries");

    await page.goto("/bildegalleri/");

    const grid = page.locator('main div[x-data]');
    await grid.locator("div").first().click({ force: true });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(`1 / ${photos.length}`)).toBeVisible();

    // next
    await dialog.getByRole("button", { name: "Neste bilde" }).click();
    await expect(dialog.getByText(`2 / ${photos.length}`)).toBeVisible();

    // prev
    await dialog.getByRole("button", { name: "Forrige bilde" }).click();
    await expect(dialog.getByText(`1 / ${photos.length}`)).toBeVisible();

    // Escape closes
    await dialog.press("Escape");
    await expect(dialog).toBeHidden();

    expect(errors).toEqual([]);
  });
});
