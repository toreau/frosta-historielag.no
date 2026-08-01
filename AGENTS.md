# Frosta Historielag — Astro 6 + Tailwind v4

Static site for a Norwegian local history society. Deployed on Cloudflare Pages.

## Commands

```bash
npm run dev          # local dev server
npm run build        # convert-webp.mjs → astro build → pagefind index → dist/
npm run preview      # preview built site
npm run check        # astro check (typecheck — OOMs on Node 26, use 22/24 LTS)
npm run test         # vitest: unit + content + build (build tests need dist/)
npm run test:unit    # vitest tests/unit — markdown.ts + site.json
npm run test:content # vitest tests/content — image refs, links, frontmatter schemas
npm run test:build   # build + vitest tests/build — sitemap, pagefind, HTML invariants
npm run test:e2e     # playwright — builds dist, serves via wrangler pages dev (applies _headers/_redirects)
npm run generate-types  # wrangler types (Cloudflare)
```

## Testing

- **Vitest** (`tests/`): unit tests for `src/lib/markdown.ts` + `site.json`; content-integrity tests that mirror the route model and check image/`.webp`/responsive-variant refs, internal links, frontmatter schemas; build tests asserting sitemap/pagefind/HTML invariants on `dist/`. Content-driven: expectations derive from `src/content/` + `src/data/site.json`, so editors adding content won't break tests.
- **Playwright** (`e2e/`): chromium desktop + mobile projects; `webServer` runs `npm run build && npx wrangler pages dev dist --port 4321` (wrangler is required — `astro preview` omits `_headers`, breaking CSP tests). Covers nav/redirects/404, event listings, membership form (POST intercepted — no real email), products, search (Pagefind under CSP), admin/Decap boot (CSP regression), gallery lightbox, header dropdown, sitemap crawl, axe a11y scans.
- **CI**: `.github/workflows/ci.yml` — Node 22, `npm ci` → check → unit/content → build → build tests → playwright. Runs on push + PRs; Cloudflare Pages auto-deploy unchanged.
- Gotchas: `astro check` OOMs on Node 26 (use 22/24); a11y scans are default-on and fail on serious/critical axe violations only.

## Astro 6 content collections

- Config lives at `src/content.config.ts` (NOT `src/content/config.ts`).
- Collections require explicit loaders: `glob({ pattern: "**/*.md", base: "./src/content/events" })`.
- `entry.render()` does NOT exist. Use `entry.body` for raw markdown string.
- Content lives in `src/content/{events,gallery,pages,products,reports}/**.md`.
- Key schema fields: `section` on `pages` routes to `/historie/` or `/om-oss/`; `category` on `products` routes to subpages; `published` (boolean, default `true`) gates visibility.

## Tailwind v4 — CSS-first config

- No `tailwind.config.js`. Configuration is in `src/styles/global.css` via `@theme {}`.
- Custom colors: `forest`, `amber`, `cream`, `slate`, `sepia` — each with shade scale 50–950.
- Custom fonts: `font-serif` (Playfair Display), `font-sans` (Inter) — both loaded from Google Fonts in `Layout.astro`.
- Vite plugin: `@tailwindcss/vite` configured in `astro.config.mjs`.

## Utility libraries (`src/lib/`)

| File | Purpose |
|---|---|
| `markdown.ts` | `renderMarkdown()` — parses markdown via `marked` (GFM + line breaks), sanitizes HTML with DOMPurify. `getExcerpt()` — strips markdown for meta descriptions. |
| `search.ts` | `executeSearch()` — lazy-loads Pagefind, searches, post-filters results (queries >= 3 chars). Used by `Search.astro` and `sok.astro`. |

## Cloudflare deployment

- **Static-only** — do NOT install `@astrojs/cloudflare` adapter. It conflicts with Cloudflare Pages static hosting.
- Config: `wrangler.jsonc` (project name `frosta-historielag`, build output `./dist`).
- Manual deploy: `npm run build && npx wrangler pages deploy dist --project-name=frosta-historielag --branch=main`
- GitHub remote: `git@github.com:toreau/frosta-historielag.no.git` (private). Cloudflare Pages integration auto-deploys on push to `main`.
- Site URL: `https://frosta-historielag.pages.dev`

## Component architecture

| Component | Purpose |
|---|---|
| `Layout.astro` | Base wrapper — HTML shell, fonts, Header + Footer, global CSS |
| `Hero.astro` | Dual-mode: `<Hero />` = typographic header + breadcrumbs; `<Hero image="..." />` = compact image banner (30vh) |
| `Header.astro` | Sticky nav with Alpine.js mobile menu. Logo inside dark pill (`bg-forest-800`) |
| `Footer.astro` | 3-column: about, contact, support. Uses `site.json` data |
| `ProductCard.astro` | Card with image, name, price, mailto link |
| `EventCard.astro` | Horizontal card with date, time, location, description |
| `PhotoGrid.astro` | Gallery grid with Alpine.js lightbox |
| `CallToAction.astro` | Reusable CTA section. Props: `heading`, `body`, `buttons[]`, `showPrices` |
| `Image.astro` | Optimized `<img>` — `<picture>` wrapper with WebP + responsive `srcset` variants |
| `Search.astro` | Pagefind-powered search input with results dropdown, Norwegian labels |

## Site data

- `src/data/site.json` — all shared data: nav items, contact info, board members, membership prices, Vipps/account numbers.
- Nav is driven by `site.nav` array. Adding a page = add to `nav` array + create the `.astro` file.
- Product subpages (`produkter/arbok`, `div-boker`, `frostabokene`, `frostabasen`, `kalender`, `smykker`) filter products by the `category` frontmatter field.

## Alpine.js

- Loaded from local `public/js/alpine.min.js` + `alpine-focus.min.js` in `Header.astro`.
- Used for: mobile menu toggle (Header) and gallery lightbox (PhotoGrid).
- `[x-cloak] { display: none !important; }` is in `global.css`.

## Form handling

- Membership form (`src/pages/bli-medlem.astro`) uses [FormSubmit](https://formsubmit.co).
- Action: `https://formsubmit.co/frosta.historielag@gmail.com`
- First submission triggers an activation email — someone must click it once.

## Decap CMS (content editing for non-technical users)

- Admin panel at `/admin/` — loads from `public/admin/index.html` + `public/admin/config.yml`.
- The Decap bundle is **vendored** at `public/admin/decap-cms.js` (was unpkg CDN, blocked by CSP). Update: `curl -sL "https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js" -o public/admin/decap-cms.js`.
- Edits events (`src/content/events/`), products (`src/content/products/`), and site settings (`src/data/site.json`).
- Changes committed via GitHub backend → Cloudflare auto-deploys.
- Requires a GitHub OAuth App for login (one-time setup, instructions in `scripts/setup-decap.md`).
- `functions/[[handler]].js` — Cloudflare Pages function that proxies GitHub OAuth (`/auth` → GitHub authorize → `/callback` → token exchange). Requires `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` env vars. Private repo → must also set `GITHUB_REPO_PRIVATE` (else OAuth asks only `public_repo` scope).

## Cloudflare static assets

- `public/_headers` — Cache-Control: images/pagefind 1yr immutable, favicon 1wk, and `Content-Security-Policy` header. `/admin/*` gets a relaxed override (GitHub API in `connect-src`).
- `public/_redirects` — Trailing-slash redirects for `/slekt`, `/historie`, `/produkter`.

## Images

- All images local in `public/images/`. Referenced as `/images/filename.jpg`.
- `scripts/convert-webp.mjs` — idempotent WebP converter (sharp); also generates responsive variants at 480w, 960w, 1440w.
- `scripts/download-images.sh` — idempotent downloader from old WordPress server (reads `scripts/image-map.txt`).
- `scripts/update-references.sh` — update image URLs in source after download.

## Norwegian content

- All UI text is Norwegian Bokmål. `<html lang="nb-NO">`.
- Norwegian characters (æøå) are used in file paths, content, and labels.
