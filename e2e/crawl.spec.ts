import { expect, test } from "@playwright/test";
import { collectConsoleErrors, collectFailedRequests } from "./utils";

test.describe("sitemap crawl", () => {
  test("every sitemap URL returns 200", async ({ page }) => {
    const res = await page.request.get("/sitemap-0.xml");
    expect(res.status()).toBe(200);
    const sitemap = await res.text();

    const urls = [...sitemap.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(25);

    const failures: string[] = [];
    for (const url of urls) {
      const r = await page.request.get(url, { maxRedirects: 5 });
      if (r.status() !== 200) failures.push(`${url} -> ${r.status()}`);
    }
    expect(failures).toEqual([]);
  });

  test("representative pages have no console errors or failed assets", async ({ page }) => {
    for (const path of ["/", "/historie/", "/produkter/", "/om-oss/", "/arsmeldinger/"]) {
      const errors = collectConsoleErrors(page);
      const failed = collectFailedRequests(page);

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(errors, `console errors on ${path}: ${errors.join("; ")}`).toEqual([]);
      expect(failed, `failed assets on ${path}: ${failed.map((f) => f.url).join("; ")}`).toEqual([]);
    }
  });
});
