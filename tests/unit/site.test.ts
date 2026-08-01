import { describe, expect, it } from "vitest";
import { readSite } from "../helpers/content";

describe("site.json", () => {
  const site = readSite();

  it("has required identity fields", () => {
    expect(typeof site.name).toBe("string");
    expect(site.name.length).toBeGreaterThan(0);
    expect(typeof site.tagline).toBe("string");
    expect(typeof site.founded).toBe("number");
    expect(site.email).toMatch(/@/);
    expect(typeof site.phone).toBe("string");
  });

  it("has nav entries with unique, non-empty hrefs", () => {
    expect(Array.isArray(site.nav)).toBe(true);
    expect(site.nav.length).toBeGreaterThanOrEqual(8);
    const hrefs = site.nav.map((n: { href: string }) => n.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const n of site.nav) {
      expect(n.label).toBeTruthy();
      expect(n.href.startsWith("/")).toBe(true);
    }
  });

  it("has valid membership prices", () => {
    expect(Number.isInteger(site.membership.single)).toBe(true);
    expect(Number.isInteger(site.membership.family)).toBe(true);
    expect(site.membership.single).toBeGreaterThan(0);
    expect(site.membership.family).toBeGreaterThan(site.membership.single);
  });

  it("has board members with role, name and phone", () => {
    expect(Array.isArray(site.board)).toBe(true);
    expect(site.board.length).toBeGreaterThanOrEqual(3);
    for (const m of site.board) {
      expect(m.role).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.phone).toBeTruthy();
    }
    expect(Array.isArray(site.boardDeputies)).toBe(true);
    for (const d of site.boardDeputies) {
      expect(d.name).toBeTruthy();
      expect(d.phone).toBeTruthy();
    }
  });

  it("has payment details", () => {
    expect(String(site.vipps)).toBeTruthy();
    expect(String(site.account)).toBeTruthy();
  });
});
