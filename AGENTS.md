# Frosta Historielag — Astro 6 + Tailwind v4

Static site for a Norwegian local history society. Deployed on Cloudflare Pages.

## Commands

```bash
npm run dev          # local dev server
npm run build        # static build → dist/
npm run preview      # preview built site
npm run generate-types  # wrangler types (Cloudflare)
```

## Astro 6 content collections

- Config lives at `src/content.config.ts` (NOT `src/content/config.ts`).
- Collections require explicit loaders: `glob({ pattern: "**/*.md", base: "./src/content/events" })`.
- `entry.render()` does NOT exist. Use `entry.body` for raw markdown string.
- Content lives in `src/content/{events,products,reports}/**.md`.

## Tailwind v4 — CSS-first config

- No `tailwind.config.js`. Configuration is in `src/styles/global.css` via `@theme {}`.
- Custom colors: `forest`, `amber`, `cream`, `slate`, `sepia` — each with shade scale 50–950.
- Custom fonts: `font-serif` (Playfair Display), `font-sans` (Inter) — both loaded from Google Fonts in `Layout.astro`.
- Vite plugin: `@tailwindcss/vite` configured in `astro.config.mjs`.

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

## Site data

- `src/data/site.json` — all shared data: nav items, contact info, board members, membership prices, Vipps/account numbers.
- Nav is driven by `site.nav` array. Adding a page = add to `nav` array + create the `.astro` file.

## Alpine.js

- Loaded via CDN in `Header.astro` (`<script defer>`).
- Used for: mobile menu toggle (Header) and gallery lightbox (PhotoGrid).
- `[x-cloak] { display: none !important; }` is in `global.css`.

## Form handling

- Membership form (`src/pages/bli-medlem.astro`) uses [FormSubmit](https://formsubmit.co).
- Action: `https://formsubmit.co/frosta.historielag@gmail.com`
- First submission triggers an activation email — someone must click it once.

## Decap CMS (content editing for non-technical users)

- Admin panel at `/admin/` — loads from `public/admin/index.html` + `public/admin/config.yml`.
- Edits events (`src/content/events/`), products (`src/content/products/`), and site settings (`src/data/site.json`).
- Changes committed via GitHub backend → Cloudflare auto-deploys.
- Requires a GitHub OAuth App for login (one-time setup, instructions in `scripts/setup-decap.md`).

## Images

- All images local in `public/images/`. Referenced as `/images/filename.jpg`.
- `scripts/download-images.sh` — idempotent downloader from old WordPress server (reads `scripts/image-map.txt`).
- `scripts/update-references.sh` — update image URLs in source after download.

## Norwegian content

- All UI text is Norwegian Bokmål. `<html lang="no">`.
- Norwegian characters (æøå) are used in file paths, content, and labels.
