import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const events = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/events" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    time: z.string().optional(),
    location: z.string().optional(),
    image: z.string().optional(),
    published: z.boolean().default(true),
  }),
});

const products = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/products" }),
  schema: z.object({
    name: z.string(),
    category: z.string(),
    price: z.number(),
    image: z.string().optional(),
    published: z.boolean().default(true),
  }),
});

const reports = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/reports" }),
  schema: z.object({
    title: z.string(),
    year: z.number(),
    date: z.string().optional(),
    published: z.boolean().default(true),
  }),
});

export const collections = { events, products, reports };
