import { expect, test } from "@playwright/test";
import { collectConsoleErrors, collectFailedRequests } from "./utils";

test.describe("search", () => {
  test("header dropdown shows debounced results and navigates on Enter", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const failed = collectFailedRequests(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Åpne søk" }).first().click();
    const input = page.getByRole("textbox", { name: "Søk på siden" });
    await input.fill("frostatinget");

    await expect(page.locator("#search-results a").first()).toBeVisible({ timeout: 10_000 });
    const firstHref = await page.locator("#search-results a").first().getAttribute("href");
    expect(firstHref).toBeTruthy();

    await input.press("Enter");
    await page.waitForURL(/\/sok\/?\?q=frostatinget/);
    await expect(page.getByText(/treff/)).toBeVisible();

    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });

  test("results page renders matches with link to the page", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/sok/?q=frostatinget");
    await expect(page.getByRole("heading", { name: "Søk: frostatinget" })).toBeVisible();
    const first = page.locator("#search-page-results a").first();
    await expect(first).toBeVisible();
    expect(await first.getAttribute("href")).toBeTruthy();
    expect(errors).toEqual([]);
  });

  test("no-results state renders", async ({ page }) => {
    await page.goto("/sok/?q=zzzzzqqqxy");
    await expect(page.getByText(/Ingen treff for/)).toBeVisible({ timeout: 10_000 });
  });

  test("short queries (<2 chars) do not trigger results", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Åpne søk" }).first().click();
    const input = page.getByRole("textbox", { name: "Søk på siden" });
    await input.fill("a");
    await expect(page.locator("#search-results")).toBeHidden();
  });
});
