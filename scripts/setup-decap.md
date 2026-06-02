# Sette opp Decap CMS (GitHub-innlogging)

For at styremedlemmer skal kunne logge inn i Decap CMS på `/admin/`,
må du opprette en GitHub OAuth App. Dette gjøres én gang og er gratis.

## Steg 1: Opprett GitHub OAuth App

1. Gå til https://github.com/settings/developers
2. Velg **OAuth Apps** → **New OAuth App**
3. Fyll ut:
   - **Application name**: Frosta Historielag CMS
   - **Homepage URL**: https://frosta-historielag.pages.dev
   - **Authorization callback URL**: https://api.netlify.com/auth/done
4. Klikk **Register application**
5. Klikk **Generate a new client secret**
6. Kopier **Client ID** og **Client Secret** — du trenger dem i steg 2

## Steg 2: Test

Gå til https://frosta-historielag.pages.dev/admin/ og klikk **Login with GitHub**.

Godkjenn tilgangen, så skal du være inne i admin-panelet.

## Feilsøking

- **"Failed to authenticate"** — Sjekk at callback URL i OAuth Appen er helt lik `https://api.netlify.com/auth/done`
- **Blank side** — Åpne nettleserens konsoll (F12) og se etter JavaScript-feil
- **Kan ikke lagre** — Sjekk at GitHub-brukeren din har skrivetilgang til repoet

## Hvordan det fungerer

Decap CMS er en ren frontend-app (ingen server). Når noen redigerer innhold:

1. Endringene blir til en Git-commit via GitHub API
2. Committen pushes til `main`-branchen
3. Cloudflare Pages oppdager ny commit og bygger siden på nytt
4. Ferdig — endringen er live på ~1 minutt
