// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/sok"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        external: /^\/pagefind\//,
      },
    },
  },
  site: "https://frosta-historielag.pages.dev",
});
