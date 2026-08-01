import { expect, test } from "@playwright/test";
import { collectConsoleErrors, collectFailedRequests } from "./utils";

test.describe("admin panel (Decap CMS)", () => {
  test("Decap boots without CSP violations", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const failed = collectFailedRequests(page);

    await page.goto("/admin/");

    // Decap renders its login screen when the bundle executed
    await expect(page.getByRole("button", { name: "Login with GitHub" })).toBeVisible({
      timeout: 15_000,
    });

    // Regression guard: the bundle must come from self (no unpkg CDN calls)
    const externalScripts = await page.evaluate(() =>
      [...document.scripts]
        .map((s) => s.src)
        .filter((s) => s.startsWith("http") && new URL(s).origin !== location.origin)
    );
    expect(externalScripts).toEqual([]);

    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });
});
