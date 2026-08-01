import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/hva-skjer/", "/produkter/", "/bildegalleri/", "/bli-medlem/"];

test.describe("accessibility (axe)", () => {
  for (const path of PAGES) {
    test(`${path} has no serious or critical violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const serious = results.violations.filter((v) =>
        v.impact === "serious" || v.impact === "critical"
      );

      expect(
        serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodes`),
        `violations on ${path}`
      ).toEqual([]);
    });
  }
});
