import { expect, test } from "@playwright/test";
import { contentFiles } from "./utils";

function eventDates() {
  const today = new Date().toISOString().split("T")[0];
  const events = contentFiles("events")
    .filter((e) => e.data.published !== "false")
    .map((e) => ({ title: e.data.title, date: e.data.date, body: e.body }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    today,
    events,
    upcoming: events.filter((e) => e.date >= today),
    past: events.filter((e) => e.date < today),
  };
}

test.describe("event listings (content-derived)", () => {
  test("/hva-skjer always shows past events when any exist", async ({ page }) => {
    const { past } = eventDates();
    test.skip(past.length === 0, "no past events in content");

    await page.goto("/hva-skjer/");
    await expect(page.getByRole("heading", { name: "Tidligere arrangementer" })).toBeVisible();

    // most recent past event must be listed
    const latest = past[past.length - 1];
    await expect(page.getByRole("heading", { name: latest.title })).toBeVisible();
  });

  test("/hva-skjer shows upcoming events when any exist", async ({ page }) => {
    const { upcoming } = eventDates();
    test.skip(upcoming.length === 0, "no upcoming events in content");

    await page.goto("/hva-skjer/");
    await expect(page.getByRole("heading", { name: "Kommende arrangementer" })).toBeVisible();
    for (const e of upcoming) {
      await expect(page.getByRole("heading", { name: e.title })).toBeVisible();
    }
  });

  test("homepage shows upcoming event or the empty state", async ({ page }) => {
    const { upcoming } = eventDates();
    await page.goto("/");
    const section = page.locator("main section", { has: page.getByRole("heading", { name: "Hva skjer" }) });

    if (upcoming.length > 0) {
      await expect(section.getByRole("heading", { name: upcoming[0].title })).toBeVisible();
    } else {
      await expect(section.getByText("Ingen kommende arrangementer akkurat nå.")).toBeVisible();
    }
  });

  test("event cards never leak raw markdown", async ({ page }) => {
    const { past, upcoming } = eventDates();
    if (past.length === 0 && upcoming.length === 0) test.skip(true, "no events");

    await page.goto("/hva-skjer/");
    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toContain("**");
  });
});
