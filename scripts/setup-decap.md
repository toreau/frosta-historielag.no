# Sette opp Decap CMS (GitHub-innlogging med OAuth)

Decap CMS krever en OAuth *proxy* for å håndtere GitHub-innlogging.
Dette prosjektet bruker en Cloudflare Pages Function (`functions/[[handler]].js`)
som OAuth-håndterer. Du må opprette en GitHub OAuth App og sette miljøvariabler
i Cloudflare Pages.

Repositoriet `toreau/frosta-historielag.no` er **offentlig**. OAuth-flyten ber
om scope **`public_repo`** (les/skriv til offentlige repositories brukeren har
tilgang til). `public_repo` er smalere enn `repo`, men er ikke begrenset til
dette ene repositoriet.

## Steg 1: Opprett GitHub OAuth App

1. Gå til https://github.com/settings/developers
2. Velg **OAuth Apps** → **New OAuth App**
3. Fyll ut:
   - **Application name**: Frosta Historielag CMS
   - **Homepage URL**: https://frosta-historielag.pages.dev
   - **Application callback URL**: https://frosta-historielag.pages.dev/callback
4. Klikk **Register application**
5. Klikk **Generate a new client secret**
6. Kopier **Client ID** og **Client Secret**: du trenger dem i steg 2
7. Kontroller at **wildcard callback matching** er **av** for callback-URL-en
   (exact match kreves).

## Steg 2: Sett miljøvariabler i Cloudflare Pages

1. Gå til Cloudflare Dashboard → Workers & Pages → `frosta-historielag`
2. Velg **Settings** → **Environment variables**
3. Legg til:
   - `DECAP_OAUTH_ORIGIN` = `https://frosta-historielag.pages.dev` (ikke-secret)
   - `GITHUB_CLIENT_ID` = Client ID fra steg 1
   - `GITHUB_CLIENT_SECRET` = Client Secret fra steg 1 (secret)
4. `GITHUB_REPO_PRIVATE` brukes ikke lenger og skal **ikke** settes.
5. **Redeploy** prosjektet (Cloudflare trenger en ny deployment for å plukke opp env vars + aktivere Functions)

## Steg 3: Test

1. Gå til https://frosta-historielag.pages.dev/admin/
2. Klikk **Login with GitHub**
3. Godkjenn tilgang (scope: `public_repo`)
4. Du skal nå se admin-panelet med Arrangementer, Produkter og Innstillinger

## Slik fungerer det

```
Editor klikker "Login with GitHub" på /admin/
  → popup åpner /auth (Pages Function)
    → redirect til GitHub OAuth med state + PKCE
      → GitHub redirect til /callback (Pages Function)
        → verifiserer state, bytter code mot token med code_verifier
          → token sendes til popup → videre til admin-panelet ✅
```

## Feilsøking

- **"Failed to authenticate"**: Sjekk at Client ID og Client Secret stemmer
- **"OAuth is not configured"**: `DECAP_OAUTH_ORIGIN` mangler eller er ugyldig
- **"Missing code"**: GitHub redirectet uten authorization code
- **Blank side på /admin/**: Åpne konsollen (F12), se etter JS-feil
- **"Repository not found"**: Sjekk at GitHub-brukeren din har skrivetilgang til `toreau/frosta-historielag.no`
- **Funksjonen kjører ikke**: Sjekk at `functions/[[handler]].js` finnes i repoet og at Cloudflare Pages Functions er aktivert

## Admin-panelets oppbygning

| Samling | Hva som kan redigeres | Lagres i |
|---|---|---|
| Arrangementer | Tittel, dato, tid, sted, bilde, beskrivelse | `src/content/events/*.md` |
| Produkter | Navn, kategori, pris, bilde, beskrivelse | `src/content/products/*.md` |
| Innstillinger | Kontaktinfo, styret, medlemspriser | `src/data/site.json` |

Endringer i admin-panelet blir til Git-commits på `main`-branchen.
Cloudflare Pages bygger siden på nytt automatisk.
