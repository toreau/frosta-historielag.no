# CSP Analysis: Can `unsafe-inline` Be Removed?

> **For Hermes:** Run `opencode run 'Analyze CSP' -f .hermes/plans/2025-06-07-csp-analysis.md`

**Goal:** Determine if the `unsafe-inline` directive in the Content-Security-Policy can be safely removed without breaking functionality.

**Type:** Read-only analysis. No code changes. Output is a written assessment.

---

## Task: Analyze CSP `unsafe-inline` Necessity

**File to inspect:** `public/_headers` (line 14)

Current CSP:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; form-action https://formsubmit.co; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; object-src 'none'
```

Two inline allowances:
- `script-src: 'unsafe-inline'` — allows inline `<script>` blocks and `onclick` handlers
- `style-src: 'unsafe-inline'` — allows inline `<style>` blocks and `style=` attributes

### Analysis Steps

1. **Count inline `<script>` blocks** — search all `.astro` files for `<script>` (not `<script src=...>`, not `import` inside `<script>`). These run inline and would be blocked without `unsafe-inline`.

   ```bash
   rg '<script[^>]*>' src/ --no-filename | grep -v 'src=' | grep -v 'is:inline'
   ```

2. **Count Alpine.js event handlers** — search for `x-on:click`, `@click`, `x-on:keydown`, `@keydown`, `x-on:*` with inline JavaScript. These use `onclick`-style attributes which fall under `unsafe-inline`.

   ```bash
   rg 'x-on:\w+=' src/ --no-filename
   rg '@(click|keydown|keyup|mouseenter|mouseleave|submit)' src/ --no-filename
   ```

3. **Count inline `<style>` blocks** — search for `<style>` (not `<style is:inline>`, which Astro extracts). Astro's `is:inline` directive means the style IS inlined in the HTML, requiring `unsafe-inline`.

   ```bash
   rg '<style' src/ --no-filename | grep 'is:inline'
   ```

4. **Identify what WOULD break** — for each inline script/style found, determine:
   - Is it Astro `is:inline` (baked into HTML — needs `unsafe-inline`)?
   - Is it Alpine.js `x-on:*` (needs `unsafe-inline`)?
   - Is it a `<script>` block with `import` (module — might not need `unsafe-inline`)?
   - Could it be moved to an external file or replaced with a CSP hash/nonce?

5. **Check `unsafe-eval`** — does Alpine.js actually use `eval()`? If yes, `unsafe-eval` is required. If no, it could potentially be removed too.

### Deliverable

A summary in this format:

```
CSP ANALYSIS RESULT
===================

unsafe-inline (script-src):
  - Inline <script> blocks found: N
  - Alpine x-on:* event handlers found: N
  - Verdict: CAN / CANNOT remove (because...)

unsafe-inline (style-src):
  - Inline <style is:inline> blocks found: N
  - Inline style= attributes found: N
  - Verdict: CAN / CANNOT remove (because...)

unsafe-eval:
  - Alpine eval usage: YES / NO
  - Verdict: CAN / CANNOT remove (because...)

Recommendation:
  [One of:]
  - Remove unsafe-inline entirely
  - Remove from script-src only
  - Remove from style-src only
  - Keep as-is (explain why)
  - Replace with CSP nonces/hashes (which files need it)
```

### Verification

Read-only — no build needed. Just check that all searches were run and counts are accurate.
