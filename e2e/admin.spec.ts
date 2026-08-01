import { expect, test } from "@playwright/test";
import { collectConsoleErrors, collectFailedRequests } from "./utils";

test.describe("admin panel (Decap CMS)", () => {
  test("CSP is delivered via meta tag, not response headers", async ({ page }) => {
    // Cloudflare merges duplicate _headers rules across matching paths, and
    // browsers AND multiple CSPs — which would re-block api.github.com on
    // /admin/*. The relaxed policy must therefore come from the document
    // itself, never from a header.
    const res = await page.request.get("/admin/");
    expect(res.headers()["content-security-policy"]).toBeUndefined();

    await page.goto("/admin/");
    const metaContent = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");
    expect(metaContent).toContain("connect-src 'self' https://api.github.com");
  });

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
