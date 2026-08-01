import { expect, test } from "@playwright/test";
import { contentFiles, readSite } from "./utils";

const CATEGORY_ROUTES: Record<string, string> = {
  bok: "/produkter/frostabokene",
  "annen-bok": "/produkter/div-boker",
  kalender: "/produkter/kalender",
  smykke: "/produkter/smykker",
  digitalt: "/produkter/frostabasen",
};

test.describe("product category pages (content-derived)", () => {
  for (const [category, route] of Object.entries(CATEGORY_ROUTES)) {
    test(`${route} lists all published ${category} products`, async ({ page }) => {
      const products = contentFiles("products").filter(
        (p) => p.data.published !== "false" && p.data.category === category
      );
      test.skip(products.length === 0, `no ${category} products`);

      await page.goto(route);

      if (category === "digitalt") {
        // Frostabasen page renders price + details instead of product cards
        await expect(page.getByText(`kr ${products[0].data.price},-`)).toBeVisible();
        return;
      }

      for (const p of products) {
        await expect(page.getByRole("heading", { name: p.data.name, exact: true })).toBeVisible();
      }
    });
  }

  test("overview page links all six category pages", async ({ page }) => {
    await page.goto("/produkter/");
    for (const label of ["Frostabøkene", "Frostabasen", "Frostakalenderen", "Årbok", "Smykker", "Div. bøker"]) {
      await expect(page.getByRole("heading", { name: label })).toBeVisible();
    }
  });

  test("no product card renders 'kr 0,-'", async ({ page }) => {
    for (const route of Object.values(CATEGORY_ROUTES)) {
      await page.goto(route);
      await expect(page.getByText("kr 0,-")).toHaveCount(0);
    }
  });

  test("Bestill links are well-formed mailto links", async ({ page }) => {
    const site = readSite();
    await page.goto("/produkter/frostabokene/");
    const bestill = page.getByRole("link", { name: /Bestill/ }).first();
    await expect(bestill).toHaveAttribute("href", new RegExp(`^mailto:${site.email}\\?subject=Bestilling:`));
  });
});
