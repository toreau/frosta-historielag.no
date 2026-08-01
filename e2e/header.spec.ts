import { expect, test } from "@playwright/test";
import { collectConsoleErrors } from "./utils";

test.describe("header navigation", () => {
  test.skip(({ isMobile }) => !!isMobile, "desktop-only (Om oss dropdown)");

  test("desktop: Om oss dropdown opens on click and toggles aria-expanded", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto("/");
    const button = page.getByRole("button", { name: "Om oss", exact: true });
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Om laget" })).toBeVisible();

    // Escape closes the dropdown
    await button.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("link", { name: "Om laget" })).toBeHidden();

    // Hover (re-enter) also opens it — desktop mouse behavior
    await page.mouse.move(5, 5);
    await button.hover();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    expect(errors).toEqual([]);
  });

  test("desktop: search button toggles the search bar", async ({ page }) => {
    await page.goto("/");
    const searchBtn = page.getByRole("button", { name: "Åpne søk" }).first();
    await searchBtn.click();
    await expect(page.getByRole("textbox", { name: "Søk på siden" })).toBeVisible();
    await searchBtn.click();
    await expect(page.getByRole("textbox", { name: "Søk på siden" })).toBeHidden();
  });
});

test.describe("mobile navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile-only (hamburger menu)");

  test("hamburger menu opens and accordion toggles", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Meny" }).click();

    const menu = page.getByRole("navigation", { name: "Mobilmeny" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Slekt" })).toBeVisible();

    // Accordion
    const accordion = menu.getByRole("button", { name: /Om oss/ });
    await expect(accordion).toHaveAttribute("aria-expanded", "false");
    await accordion.click();
    await expect(accordion).toHaveAttribute("aria-expanded", "true");
    await expect(menu.getByRole("link", { name: "Om laget" })).toBeVisible();

    // Search button in mobile header opens the search bar
    await page.getByRole("button", { name: "Åpne søk" }).click();
    await expect(page.getByRole("textbox", { name: "Søk på siden" })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
