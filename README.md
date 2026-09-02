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
ArgoCD) som **referanseapp** for den sky-drevne GitOps-løypen: CI tester og invokerer den
sentrale trusted reusable builder (`container-build-attest.yml`), som bygger ett arm64-bilde
(`ghcr.io/toreau/frosta-historielag.no`, `main-<sha>`), genererer SLSA-provenance + SPDX-SBOM,
og returnerer digesten. CI dispatcher `app-image-pushed` til k8s-research → promotion
(sterk provenance-gate) → bump-PR → review → merge → ArgoCD auto-synker. Cluster-kopien er
admission-enforced som valgt referanseapp: Sigstore Policy Controller krever attestasjon
signert av trusted central `container-build-attest`-workflowen ved en godtatt
builder-revisjon for referanse-image-scope (`ghcr.io/toreau/frosta-historielag.no**`) i
namespace `frosta-historielag`. Produksjonen (Cloudflare) er uendret; Cloudflare-`functions/`
er ikke med i cluster-kopien (statisk kun, Decap-admin uten innlogging).

APPSEC-02.4 positive-enforcement probe marker (temporary, never merged).
