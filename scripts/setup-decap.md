# Sette opp Decap CMS (GitHub-innlogging med OAuth)

Decap CMS krever en OAuth *proxy* for å håndtere GitHub-innlogging.
Dette prosjektet bruker en Cloudflare Pages Function (`functions/[[handler]].js`)
som OAuth-håndterer. Du må opprette en GitHub OAuth App og sette to miljøvariabler
i Cloudflare Pages.

## Steg 1: Opprett GitHub OAuth App

1. Gå til https://github.com/settings/developers
2. Velg **OAuth Apps** → **New OAuth App**
3. Fyll ut:
   - **Application name**: Frosta Historielag CMS
   - **Homepage URL**: https://frosta-historielag.pages.dev
   - **Application callback URL**: https://frosta-historielag.pages.dev/callback
4. Klikk **Register application**
5. Klikk **Generate a new client secret**
6. Kopier **Client ID** og **Client Secret** — du trenger dem i steg 2

## Steg 2: Sett miljøvariabler i Cloudflare Pages

1. Gå til Cloudflare Dashboard → Workers & Pages → `frosta-historielag`
2. Velg **Settings** → **Environment variables**
3. Legg til tre variabler (alle som **Secret**):
   - `GITHUB_CLIENT_ID` = Client ID fra steg 1
   - `GITHUB_CLIENT_SECRET` = Client Secret fra steg 1
   - `GITHUB_REPO_PRIVATE` = `1` (repoet er privat)
4. **Redeploy** prosjektet (Cloudflare trenger en ny deployment for å plukke opp env vars + aktivere Functions)

## Steg 3: Test

1. Gå til https://frosta-historielag.pages.dev/admin/
2. Klikk **Login with GitHub**
3. Godkjenn tilgang
4. Du skal nå se admin-panelet med Arrangementer, Produkter og Innstillinger

## Slik fungerer det

```
Editor klikker "Login with GitHub" på /admin/
  → popup åpner /auth (Pages Function)
    → redirect til GitHub OAuth
      → GitHub redirect til /callback (Pages Function)
        → bytter code mot token (GitHub API)
          → token sendes til popup → videre til admin-panelet ✅
```

## Feilsøking

- **"Failed to authenticate"** — Sjekk at Client ID og Client Secret stemmer
- **"Invalid provider"** — URL-en har feil `provider`-parameter
- **"Missing code"** — GitHub redirectet uten authorization code
- **Blank side på /admin/** — Åpne konsollen (F12), se etter JS-feil
- **"Repository not found"** — Sjekk at GitHub-brukeren din har skrivetilgang til `toreau/frosta-historielag.no`
- **Funksjonen kjører ikke** — Sjekk at `functions/[[handler]].js` finnes i repoet og at Cloudflare Pages Functions er aktivert

## Admin-panelets oppbygning

| Samling | Hva som kan redigeres | Lagres i |
|---|---|---|
| Arrangementer | Tittel, dato, tid, sted, bilde, beskrivelse | `src/content/events/*.md` |
| Produkter | Navn, kategori, pris, bilde, beskrivelse | `src/content/products/*.md` |
| Innstillinger | Kontaktinfo, styret, medlemspriser | `src/data/site.json` |

Endringer i admin-panelet blir til Git-commits på `main`-branchen.
Cloudflare Pages bygger siden på nytt automatisk.
