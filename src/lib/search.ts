interface SearchResult {
  url: string;
  title: string;
  excerpt: string;
}

let pagefindInstance: any;

async function getPagefind() {
  if (!pagefindInstance) {
    // @ts-expect-error — /pagefind/* is generated into dist/ at build time
    // (pagefind CLI) and kept external via astro.config.mjs rollupOptions.
    pagefindInstance = await import("/pagefind/pagefind.js");
    await pagefindInstance.options({ baseUrl: "/" });
  }
  return pagefindInstance;
}

export async function executeSearch(
  query: string,
  limit?: number
): Promise<SearchResult[]> {
  const pf = await getPagefind();
  const result = await pf.search(query);
  if (!result?.results?.length) return [];

  const source = limit != null ? result.results.slice(0, limit) : result.results;

  const items: SearchResult[] = await Promise.all(
    source.map(async (r: any) => {
      const data = await r.data();
      return {
        url: data.url,
        title: data.meta?.title || data.url,
        excerpt: data.excerpt || "",
      };
    })
  );

  if (query.length >= 3) {
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.excerpt.toLowerCase().includes(q)
    );
  }

  return items;
}
