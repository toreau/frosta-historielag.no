# Localisation Strategy — Frosta Historielag

**Status:** Deferred — revisit when translation is needed.
**Last updated:** 2026-06-06

## Goal

Support English (and potentially more languages) while keeping the Decap CMS editor workflow unchanged. Editors always write in Norwegian. Translations happen automatically post-commit, before the site builds.

## Architecture

```
Editor → Decap CMS → GitHub commit (Norwegian only)
                         ↓
                  GitHub Action trigger
                         ↓
                  DeepL API translation script
                         ↓
                  Commit English content files
                         ↓
                  Cloudflare Pages builds
                  both / and /en/ routes
```

## Three layers to translate

### Layer 1: UI strings (`src/i18n/`)

Button labels, form placeholders, aria labels, breadcrumb maps, nav items. These are hardcoded in `.astro` templates and never change via Decap CMS.

**Plan:** Extract to `src/i18n/no.json` and `src/i18n/en.json`. Templates use translation keys instead of hardcoded strings. ~200 strings, translated once by hand.

Example:
```json
// src/i18n/no.json
{
  "nav.home": "Hjem",
  "nav.about": "Om oss",
  "hero.tagline": "Historien er nøkkelen til å forstå framtiden",
  "cta.join": "Bli medlem",
  "footer.support": "Støtt oss",
  "form.name": "Navn",
  "form.email": "E-post",
  "breadcrumb.home": "Hjem",
  "search.placeholder": "Søk på siden..."
}
```

```json
// src/i18n/en.json
{
  "nav.home": "Home",
  "nav.about": "About Us",
  "hero.tagline": "History is the key to understanding the future",
  "cta.join": "Become a Member",
  "footer.support": "Support Us",
  "form.name": "Name",
  "form.email": "Email",
  "breadcrumb.home": "Home",
  "search.placeholder": "Search the site..."
}
```

### Layer 2: Site data (`src/data/site.json`)

Nav labels, board roles, office hours, tagline. Changed infrequently via Decap CMS.

**Plan:** Translation script maps specific translatable fields (string values in `nav[].label`, `board[].role`, `officeHours`, `tagline`) and sends them to DeepL. Writes `src/data/site.en.json`. Fields like `vipps`, `account`, `phone`, `email`, numeric `price` values are left untranslated.

### Layer 3: Content collections (`src/content/`)

Markdown files in 5 collections — this is the bulk and what editors change regularly.

**Plan:** `scripts/translate.mjs` does the following:
1. Reads `.md` files changed in the latest commit
2. Extracts `title` + `body` from frontmatter
3. Sends text to DeepL API for Norwegian → English translation
4. Writes parallel files at `src/content/en/{collection}/{slug}.md`
5. Preserves non-text frontmatter fields (`date`, `price`, `image`, `published`, `section`, `category`)

English content files are committed to the repo alongside the Norwegian originals.

## Astro routing

```
/                          → Norwegian (current, unchanged)
/en/                       → English home
/en/om-oss                 → About Us
/en/om-oss/peder-ohlen     → Peder Ohlen (translated)
/en/produkter              → Products
/en/produkter/frostabokene → The Frosta Books
...
```

- Norwegian: no prefix (backward compatible)
- English: `/en/` prefix via `src/pages/en/` directory
- `<link rel="alternate" hreflang="...">` on every page
- Language switcher toggle in `Header.astro`

## Translation engine comparison

| Option | Quality (no→en) | Cost | Setup complexity |
|---|---|---|---|
| **DeepL API** | Best in class | Free tier: 500K chars/mo. Bulk: ~€6 one-time | REST API, simple |
| Google Cloud Translate | Good | Free tier: 500K chars/mo | GCP account required |
| Local LLM (Ollama + Llama) | Variable | Free | GPU needed in CI, complex |

**Recommendation: DeepL API.** The site has ~100 content files, ~50K words. Initial bulk translation costs ~€6. Ongoing edits (a few pages/month) fit comfortably in the free tier.

## Files affected

| File | What changes |
|---|---|
| `src/i18n/no.json` | **New** — Norwegian UI string dictionary |
| `src/i18n/en.json` | **New** — English translations (hand-written, one-time) |
| `src/i18n/utils.ts` | **New** — `t(key, locale)` helper function |
| `scripts/translate.mjs` | **New** — DeepL-based translation script |
| `.github/workflows/translate.yml` | **New** — GitHub Action trigger |
| `src/layouts/Layout.astro` | `hreflang` alternates, lang attribute from locale |
| `src/components/Header.astro` | Language switcher UI, translated nav items |
| `src/components/Hero.astro` | Translated breadcrumbs + label map |
| `src/components/Footer.astro` | Translated content |
| `src/components/Search.astro` | Translated labels |
| `src/pages/en/*.astro` | **New** — English page routes (mirrors Norwegian structure) |
| `src/content/en/` | **New** — Auto-translated content (committed to repo) |
| `astro.config.mjs` | i18n routing config (if using Astro i18n) |
| All `.astro` templates (~20) | Replace hardcoded Norwegian strings with `t()` calls |

## Open decisions

1. **Commit English files or .gitignore them?**
   - **Commit** (recommended): Translations are versioned, reviewable, and don't need regeneration on every build. No diff noise for unmodified content.
   - **Gitignore + regenerate:** Always fresh but adds build time and API dependency.

2. **Two CI builds or one?**
   - **Two builds** (recommended): GitHub Action translates → commits → Cloudflare auto-deploys. Cloudflare deduplicates rapid builds.
   - **One build**: Run translation inside Cloudflare Pages build. Simpler but adds latency to every deploy.

3. **Scope to English only, or plan for N languages?**
   - The `i18n` JSON approach scales to any number of languages.
   - Start with English. Add languages by creating new `src/i18n/{lang}.json` files and duplicating the page directory structure.
   - Per-language content subdirectories (`src/content/en/`, `src/content/de/`, etc.)

4. **Astro's built-in i18n or manual routing?**
   - Astro 6 has experimental `i18n.routing`. Provides automatic locale detection and redirect.
   - Manual routing gives full control over URL structure and is more predictable for a site with an existing URL scheme.
   - Recommendation: manual routing for the first language, evaluate Astro i18n when adding a third.

## Implementation order

1. Extract UI strings to `src/i18n/no.json` + create `en.json` (manual, one-time)
2. Build `t()` utility and update all templates
3. Create `src/pages/en/` mirror structure
4. Add `hreflang` tags and language switcher
5. Write `scripts/translate.mjs` (DeepL integration)
6. Set up GitHub Action (`translate.yml`)
7. Run initial bulk translation, verify quality, commit
8. Test: edit Norwegian content via Decap CMS → verify English appears
