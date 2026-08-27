# frosta-historielag.no — static Astro site
# Builds dist/ (astro + pagefind) and serves it with nginx-unprivileged (the
# proven image under Skiperator's UID-150 + readOnlyRootFilesystem; port 8080).
# Cloudflare `functions/` are not included — this is the static cluster copy.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
