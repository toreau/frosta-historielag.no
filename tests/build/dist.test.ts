import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, contentFiles, readSite } from "../helpers/content";

const DIST = path.join(ROOT, "dist");

function walkHtml(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walkHtml(p));
    else if (f.endsWith(".html")) out.push(p);
  }
  return out;
}

describe("build output exists", () => {
  it("dist contains built pages", () => {
    expect(existsSync(path.join(DIST, "index.html"))).toBe(true);
    expect(existsSync(path.join(DIST, "404.html"))).toBe(true);
  });

  it("pagefind index and worker are generated", () => {
    expect(existsSync(path.join(DIST, "pagefind/pagefind.js"))).toBe(true);
    expect(existsSync(path.join(DIST, "pagefind/pagefind-worker.js"))).toBe(true);
    expect(existsSync(path.join(DIST, "pagefind/pagefind-entry.json"))).toBe(true);
  });

  it("admin panel includes the vendored Decap bundle", () => {
    const html = readFileSync(path.join(DIST, "admin/index.html"), "utf8");
    expect(html).toContain('src="/admin/decap-cms.js"');
    expect(existsSync(path.join(DIST, "admin/decap-cms.js"))).toBe(true);
  });

  it("CSP is delivered via meta tags, never via _headers", () => {
    const headers = readFileSync(path.join(DIST, "_headers"), "utf8");
    expect(headers).not.toContain("Content-Security-Policy");

    const admin = readFileSync(path.join(DIST, "admin/index.html"), "utf8");
    expect(admin).toContain('http-equiv="Content-Security-Policy"');
    expect(admin).toContain("connect-src 'self' https://api.github.com");

    for (const page of ["index.html", "404.html"]) {
      const html = readFileSync(path.join(DIST, page), "utf8");
      expect(html).toContain('http-equiv="Content-Security-Policy"');
      expect(html).toContain("form-action https://formsubmit.co");
    }
  });

  it("Cloudflare headers and redirects are copied", () => {
    expect(existsSync(path.join(DIST, "_headers"))).toBe(true);
    expect(existsSync(path.join(DIST, "_redirects"))).toBe(true);
  });
});

describe("sitemap", () => {
  const sitemap = existsSync(path.join(DIST, "sitemap-0.xml"))
    ? readFileSync(path.join(DIST, "sitemap-0.xml"), "utf8")
    : "";

  it("is generated and contains the homepage", () => {
    expect(sitemap).toContain("https://frosta-historielag.pages.dev/</loc>");
  });

  it("excludes the noindex /sok page", () => {
    expect(sitemap).not.toContain("/sok");
  });

  it("includes every published content route", () => {
    for (const p of contentFiles("pages")) {
      const section = p.data.section || "historie";
      expect(sitemap).toContain(`/${section}/${p.slug}/`);
    }
    for (const r of contentFiles("reports")) {
      expect(sitemap).toContain(`/arsmeldinger/${r.slug}/`);
    }
  });
});

describe("rendered HTML invariants", () => {
  const htmlFiles = walkHtml(DIST);

  it("no page renders the zero-price artifact", () => {
    const offenders = htmlFiles.filter((f) => readFileSync(f, "utf8").includes("kr 0,-"));
    expect(offenders).toEqual([]);
  });

  it("membership form posts to the configured FormSubmit address", () => {
    const site = readSite();
    const html = readFileSync(path.join(DIST, "bli-medlem/index.html"), "utf8");
    expect(html).toContain(`action="https://formsubmit.co/${site.email}"`);
  });

  it("no raw markdown ** markers leak into event cards", () => {
    const offenders: string[] = [];
    for (const f of htmlFiles) {
      const txt = readFileSync(f, "utf8");
      if (txt.includes("**Finn") || txt.includes("**Gull") || txt.includes("**Ann-Carin")) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("header dropdown button has aria-haspopup", () => {
    const html = readFileSync(path.join(DIST, "index.html"), "utf8");
    expect(html).toContain("aria-haspopup=\"true\"");
    expect(html).toContain(":aria-expanded");
  });
});

describe("published gating in build output", () => {
  it("every rendered content page matches a published content entry", () => {
    const expectedPages = new Set(
      contentFiles("pages")
        .filter((p) => p.data.published !== "false")
        .map((p) => `/${p.data.section || "historie"}/${p.slug}/`)
    );
    for (const route of expectedPages) {
      const parts = route.split("/").filter(Boolean);
      expect(existsSync(path.join(DIST, ...parts, "index.html"))).toBe(true);
    }
  });
});
