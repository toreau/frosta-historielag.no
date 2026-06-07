# CSP Tightening: Remove `unsafe-inline`

> **For Hermes:** Run `opencode run 'Implement CSP tightening' -f .hermes/plans/2026-06-07-csp-tightening.md`

**Goal:** Remove `unsafe-inline` from the Content-Security-Policy by extracting the 2 remaining inline `<style>` blocks into `global.css`.

**Background:** Analysis confirmed `script-src 'unsafe-inline'` is already unnecessary (all scripts are external). Only `style-src 'unsafe-inline'` is needed — for 2 `<style is:inline>` blocks. Moving those 4 CSS rules to `global.css` lets us drop `unsafe-inline` entirely. `unsafe-eval` stays (Alpine.js requires it).

**Tech Stack:** Astro 6, Tailwind v4. Two files changed, one file edited.

---

## Task 1: Move inline styles to global.css

**File 1:** `src/components/Search.astro:96-99`

Remove the entire `<style is:inline>` block:
```html
<style is:inline>
  .pagefind-ui__search-input { display: none; }
  .pagefind-ui__drawer { display: none; }
</style>
```

**File 2:** `src/pages/sok.astro:98-101`

Remove the identical `<style is:inline>` block.

**File 3:** `src/styles/global.css` — add at the end (before the last `}`):

```css
  /* Hide Pagefind default UI — we use a custom search interface */
  .pagefind-ui__search-input { display: none; }
  .pagefind-ui__drawer { display: none; }
```

Place these inside `@layer components {}` at the end of the file (after the `.sepia-overlay::after` block on line 142).

---

## Task 2: Tighten CSP

**File:** `public/_headers:14`

Remove both `'unsafe-inline'` occurrences:

```
-  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ...
+  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' https://fonts.googleapis.com; ...
```

---

## Verification

```bash
npm run build                    # 34 pages, 0 errors, 0 warnings
grep "unsafe-inline" public/_headers    # should return NOTHING (no matches)
grep "pagefind-ui__" dist/index.html    # should still find the CSS classes in the built HTML
```

The Pagefind CSS rules should now appear in the compiled `Layout.*.css` in `dist/_astro/` instead of as inline `<style>` tags.
