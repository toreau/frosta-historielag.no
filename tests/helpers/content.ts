import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");

export function readSite() {
  return JSON.parse(readFileSync(path.join(ROOT, "src/data/site.json"), "utf8"));
}

export function parseFrontmatter(filePath: string) {
  const txt = readFileSync(filePath, "utf8");
  const m = txt.match(/^---\s*\n([\s\S]*?)\n---/);
  const data: Record<string, string> = {};
  if (!m) return { data, body: txt };
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (mm) data[mm[1]] = mm[2].replace(/^["']|["']$/g, "");
  }
  return { data, body: txt.slice(m[0].length) };
}

export function contentFiles(collection: string) {
  const dir = path.join(ROOT, "src/content", collection);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      slug: f.replace(/\.md$/, ""),
      path: path.join(dir, f),
      ...parseFrontmatter(path.join(dir, f)),
    }));
}

export function contentSlugs(collection: string) {
  return contentFiles(collection).map((f) => f.slug);
}

/** Mirrors the route model used by getStaticPaths() in the .astro pages. */
export function buildRouteSet(): Set<string> {
  const routes = new Set<string>();
  const pagesDir = path.join(ROOT, "src/pages");
  const collect = (dir: string, prefix: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) {
        collect(p, prefix + "/" + f);
      } else {
        let route = prefix + "/" + f.replace(/\.astro$/, "");
        if (f === "index.astro") route = prefix || "/";
        if (!route.includes("[")) routes.add(route);
      }
    }
  };
  collect(pagesDir, "");

  for (const p of contentFiles("pages")) {
    const section = p.data.section || "historie";
    if (p.data.published !== "false") routes.add(`/${section}/${p.slug}`);
  }
  for (const r of contentFiles("reports")) {
    if (r.data.published !== "false") routes.add(`/arsmeldinger/${r.slug}`);
  }
  routes.add("/sok");
  routes.add("/404");
  return routes;
}

/** All /images/... references in source files (astro, markdown, json). */
export function collectImageRefs() {
  const refs: { file: string; ref: string }[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) {
        if (!["node_modules", ".git", "dist", ".astro", ".wrangler", "scripts"].includes(f)) walk(p);
      } else if (/\.(astro|md|json)$/.test(f)) {
        const txt = readFileSync(p, "utf8");
        const re = /["'(]\/(images\/[^"')>\s?#]+\.(?:jpg|jpeg|png|webp))["')]/g;
        let m;
        while ((m = re.exec(txt))) refs.push({ file: p.replace(ROOT + "/", ""), ref: m[1] });
      }
    }
  };
  walk(path.join(ROOT, "src"));
  return refs;
}

export function imageFiles(): Set<string> {
  return new Set(readdirSync(path.join(ROOT, "public/images")));
}

/** All internal href="/..." links in source files. */
export function collectInternalLinks() {
  const links: { from: string; href: string }[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) {
        if (!["node_modules", ".git", "dist", ".astro", ".wrangler", "scripts"].includes(f)) walk(p);
      } else if (/\.(astro|md)$/.test(f)) {
        const txt = readFileSync(p, "utf8");
        const re = /href=["'](\/[^"']*)["']/g;
        let m;
        while ((m = re.exec(txt))) links.push({ from: p.replace(ROOT + "/", ""), href: m[1] });
      }
    }
  };
  walk(path.join(ROOT, "src"));
  return links;
}

export function isInternal(href: string) {
  return (
    !href.startsWith("http") &&
    !href.startsWith("mailto:") &&
    !href.startsWith("tel:") &&
    href !== ""
  );
}

export function normalize(href: string) {
  const h = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return h;
}
