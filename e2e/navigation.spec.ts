import { expect, test } from "@playwright/test";
import { collectConsoleErrors, collectFailedRequests, readSite } from "./utils";

test.describe("homepage", () => {
  test("renders hero, promo cards, events section and contact info", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const failed = collectFailedRequests(page);
    const site = readSite();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: site.name, level: 1 })).toBeVisible();

    for (const card of ["Bli medlem", "Kjøp produkter", "Slektsgransking"]) {
      await expect(page.getByRole("heading", { name: card, level: 3 })).toBeVisible();
    }

    await expect(page.getByText(site.tagline).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hva skjer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Besøk oss" })).toBeVisible();

    await page.evaluate(() => {
      const hero = document.querySelector<HTMLImageElement>("img[fetchpriority='high']");
      return hero ? hero.complete && hero.naturalWidth > 0 : false;
    }).then((ok) => expect(ok).toBe(true));

    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });

  test("nav links are reachable", async ({ page }) => {
    await page.goto("/");
    const site = readSite();
    for (const item of site.nav) {
      const res = await page.request.get(item.href);
      expect(res.ok(), `${item.href} returned ${res.status()}`).toBe(true);
    }
  });
});

test.describe("redirects and 404", () => {
  test("trailing-slash redirects work", async ({ page }) => {
    for (const path of ["/historie", "/slekt", "/produkter"]) {
      const res = await page.request.get(path, { maxRedirects: 5 });
      expect(res.status()).toBe(200);
      expect(res.url().endsWith(path + "/")).toBe(true);
    }
  });

  test("unknown route shows the 404 page", async ({ page }) => {
    await page.goto("/finnes-ikke-xyz");
    await expect(page.getByRole("heading", { name: "Siden finnes ikke" })).toBeVisible();
    await expect(page.getByText("404")).toBeVisible();
  });

  test("content pages are reachable without trailing slash", async ({ page }) => {
    const res = await page.request.get("/historie/amund", { maxRedirects: 5 });
    expect(res.status()).toBe(200);
    expect(res.url().endsWith("/historie/amund/")).toBe(true);
  });
});
