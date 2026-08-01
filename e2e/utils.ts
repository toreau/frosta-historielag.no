import type { Page } from "@playwright/test";

export { contentFiles, readSite } from "../tests/helpers/content";

/** Collects console errors; assert `errors` is empty at the end of the test. */
export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

/** Tracks failed (>=400) requests for images/fonts/scripts. */
export function collectFailedRequests(page: Page) {
  const failures: { url: string; status: number }[] = [];
  page.on("response", (res) => {
    const t = res.request().resourceType();
    if (t === "image" || t === "font" || t === "script" || t === "stylesheet") {
      if (res.status() >= 400) failures.push({ url: res.url(), status: res.status() });
    }
  });
  return failures;
}
