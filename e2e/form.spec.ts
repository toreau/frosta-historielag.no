import { expect, test } from "@playwright/test";
import { readSite } from "./utils";

test.describe("membership form", () => {
  test("posts to the configured FormSubmit address", async ({ page }) => {
    const site = readSite();
    await page.goto("/bli-medlem/");

    const action = await page.locator("form").getAttribute("action");
    expect(action).toBe(`https://formsubmit.co/${site.email}`);
  });

  test("has required fields and membership options", async ({ page }) => {
    await page.goto("/bli-medlem/");

    await expect(page.getByLabel("Navn *")).toBeVisible();
    await expect(page.getByLabel("E-post *")).toBeVisible();
    await expect(page.getByLabel("Telefon")).toBeVisible();

    const options = await page.locator("#type option").allTextContents();
    expect(options).toEqual(expect.arrayContaining(["Enkeltmedlem (kr 150,-)", "Familie (kr 250,-)"]));

    await expect(page.getByRole("button", { name: "Send innmelding" })).toBeVisible();
  });

  test("submission targets FormSubmit without sending a real email", async ({ page }) => {
    const site = readSite();
    let postedTo: string | null = null;
    let postData: string | null = null;

    await page.route("https://formsubmit.co/**", async (route) => {
      postedTo = route.request().url();
      postData = route.request().postData();
      await route.fulfill({ status: 200, body: "ok" });
    });

    await page.goto("/bli-medlem/");
    await page.getByLabel("Navn *").fill("Test Testesen");
    await page.getByLabel("E-post *").fill("test@example.com");
    await page.getByLabel("Telefon").fill("12345678");
    await page.locator("#type").selectOption("family");
    await page.getByRole("button", { name: "Send innmelding" }).click();

    await expect
      .poll(() => postedTo, { timeout: 10_000 })
      .toBe(`https://formsubmit.co/${site.email}`);
    expect(postData).toContain("name=Test+Testesen");
    expect(postData).toContain("test%40example.com");
  });

  test("shows the success banner after redirect with ?success=1", async ({ page }) => {
    await page.goto("/bli-medlem/?success=1");
    await expect(page.getByText("Takk for din innmelding!")).toBeVisible();
  });
});
