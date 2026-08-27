# Frosta Historielag

Nettside for Frosta Historielag — stiftet 1924. Lokalhistorie, slektsgransking, Frostabokene, Frostabasen, fotogalleri og arrangementer.

**Nettsted:** [frosta-historielag.pages.dev](https://frosta-historielag.pages.dev)

---

## Teknisk

Bygget med [Astro 6](https://astro.build) + [Tailwind CSS v4](https://tailwindcss.com) som en statisk side.

Distribuert pa [Cloudflare Pages](https://pages.cloudflare.com) — automatisk deploy ved push til `main`.

## Kommandoer

| Kommando | Beskrivelse |
|---|---|
| `npm run dev` | Lokal utviklingsserver |
| `npm run build` | Bygg statisk side til `dist/` |
| `npm run preview` | Forhandsvis bygget side |
| `npm run generate-types` | wrangler types (Cloudflare) |

## Innholdsredigering

Ikke-tekniske brukere kan redigere innhold via **Decap CMS** pa `/admin/`. CMS-et lagrer endringer direkte til GitHub, og Cloudflare bygger siden pa nytt automatisk.

For oppsett av GitHub OAuth, se `scripts/setup-decap.md`.

## Bilder

- Alle bilder ligger i `public/images/`
- `scripts/convert-webp.mjs` konverterer JPG/PNG til WebP og genererer responsive varianter (480w, 960w, 1440w)
- `scripts/download-images.sh` laster ned bilder fra gammel WordPress-server
- `scripts/image-map.txt` inneholder URL-til-filnavn-mappingen

## Klynge-kopi

Statisk kopi deployes også til det lokale k8s-research-clusteret (kind + Skiperator +
ArgoCD) som **referanseapp** for den sky-drevne GitOps-løypen: CI bygger ett arm64-bilde
(`ghcr.io/toreau/frosta-historielag.no`, `main-<sha>`/`latest`), **SLSA-attesterer** det
inline i `ci.yml`, og dispatcher `app-image-pushed` til k8s-research → gate → bump-PR →
review → merge → ArgoCD auto-synker. In-kluster håndhever Sigstore Policy Controller
attestasjonen ved admission (`policy.sigstore.dev/include=true`). Produksjonen (Cloudflare)
er uendret; Cloudflare-`functions/` er ikke med i cluster-kopien (statisk kun, Decap-admin
uten innlogging).
