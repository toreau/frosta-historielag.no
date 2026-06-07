# Audit Fixes: Orphan Pages, Decap Typo, Language Standardization

> **For Hermes:** Use subagent-driven-development — delegate Slice 2 (the meat) to OpenCode via `delegate_task(acp_command="opencode")`.

**Goal:** Fix 2 high-priority and 1 medium-priority audit findings in the Frosta Historielag Astro site.

**Architecture:** Static site changes only — no new dependencies. Three self-contained slices: typo fix, content-driven listing, language standardization.

**Tech Stack:** Astro 6, Tailwind v4, content collections, Decap CMS YAML config.

**Source:** Audit report from this session. 0 missing images confirmed. 5 orphans detected. Build is green at 34 pages.

---

## Slice 1 — Decap CMS date_format typo (HIGH, 1 file)

| Task | File | Change |
|---|---|---|
| 1 | `public/admin/config.yml:35` | `YYYY-MM-DD` → `YYYY-MM-DD` |

### Verification
- `grep "YYYY-MM-DD" public/admin/config.yml` returns 0 matches (triple Y gone)
- `grep "YYYY-MM-DD" public/admin/config.yml` matches the date_format line with correct 4 Y's

---

## Slice 2 — Connect orphan om-oss pages via content collection (HIGH, 1 file)

**Background:** The 6 æresmedlem cards on `/om-oss` are hardcoded `<a>` tags in `om-oss.astro`. Four additional `section: "om-oss"` pages (heder-og-aere, informasjon, jubileumsmarkering, ordforerens-tale) exist in the content collection but have zero incoming links — they're in the build output but unreachable.

**Fix:** Query `getCollection("pages")` with `section === "om-oss"` filter and render a link grid below the æresmedlem section. This mirrors the pattern already used in `historie.astro:116-133`.

### Change: `src/pages/om-oss.astro`

**Step 1: Add import and query** at the top of the frontmatter (after the existing imports):

```diff
--- a/src/pages/om-oss.astro
+++ b/src/pages/om-oss.astro
 ---
 import Layout from "../layouts/Layout.astro";
 import Hero from "../components/Hero.astro";
 import Image from "../components/Image.astro";
 import site from "../data/site.json";
+import { getCollection } from "astro:content";
+
+const omOssPages = await getCollection("pages", ({ data }) =>
+  data.section === "om-oss" && data.published
+);
+omOssPages.sort((a, b) => (b.data.date || "").localeCompare(a.data.date || ""));
 ---
```

**Step 2: Add link grid** after the "Utnevnt i forbindelse med..." paragraph (after line 79, before the ildsjelprisen image):

Insert this block right after `</p>` on line 79 and before the `<div class="mt-6 flex justify-center">` on line 82:

```astro
      {omOssPages.length > 0 && (
        <div class="mt-8 border-t border-slate-200 pt-8">
          <h3 class="font-serif text-xl font-semibold text-forest-800 text-center">Flere artikler</h3>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {omOssPages.map((p) => (
              <a
                href={`/om-oss/${p.id.replace(/\.md$/, "")}`}
                class="card p-4 hover:border-forest-300 transition-colors no-underline"
              >
                <span class="font-serif font-semibold text-forest-800">{p.data.title}</span>
                {p.data.date && (
                  <span class="mt-1 block text-xs text-slate-500">{p.data.date}</span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
```

**Placement context:** This goes inside the `bg-cream-100 page-section` `<section>`, inside the `<div class="container-wide">`, right after:
```
      <p class="mt-6 text-center text-sm text-slate-500">
        Utnevnt i forbindelse med Historielagets 100-årsjubileum 16. mars 2024.
      </p>
```
And before:
```
      <div class="mt-6 flex justify-center">
```
(line 82 in current file)

### Verification
- `npm run build` — 38 pages (34 existing + 4 newly linked, no change in count since they already existed, but orphan script should confirm)
- `python3 scripts/find-orphans.py dist` — orphans reduced to 1 (`/sok` only, which is intentional)
- Page `/om-oss` visually shows a "Flere artikler" grid with 10 cards (6 æresmedlem + 4 article links) below the æresmedlem section

---

## Slice 3 — Standardize language code (MEDIUM, 2 files)

| Task | File | Change |
|---|---|---|
| 1 | `public/admin/config.yml:10` | `locale: "no"` → `locale: "nb_NO"` |
| 2 | `public/manifest.json:8` | Verify `"lang": "nb-NO"` is correct (already matches Layout.astro) |

### Verification
- `grep locale public/admin/config.yml` returns `locale: "nb_NO"`
- `grep lang public/manifest.json` returns `"lang": "nb-NO"`
- `grep 'html lang' src/layouts/Layout.astro` returns `nb-NO` (no change needed — already correct)

---

## Deferred (intentionally out of scope)

- CSP tightening (`unsafe-inline` removal) — requires testing Alpine.js + Pagefind with nonce-based CSP, non-trivial
- Pagefind Component UI migration — cosmetic, zero user impact
- 404 page heading semantics — minor a11y nit, not worth churn

---

## Final Verification (after all slices)

```bash
npm run build              # 34 pages, 0 errors, 0 warnings
python3 scripts/find-orphans.py dist   # ≤1 orphans (only /sok is acceptable)
grep "YYYY-MM-DD" public/admin/config.yml   # should NOT match (triple Y gone)
grep "YYYY-MM-DD" public/admin/config.yml   # should match correct format
grep locale public/admin/config.yml         # should return nb_NO
```
