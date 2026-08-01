import { describe, expect, it } from "vitest";
import { getExcerpt, renderMarkdown, stripMarkdown } from "../../src/lib/markdown";

describe("renderMarkdown", () => {
  it("renders basic markdown to HTML", () => {
    expect(renderMarkdown("# Overskrift\n\nLitt **fet** tekst.")).toContain("<h1>Overskrift</h1>");
    expect(renderMarkdown("# Overskrift\n\nLitt **fet** tekst.")).toContain("<strong>fet</strong>");
  });

  it("renders single newlines as <br> (breaks: true)", () => {
    expect(renderMarkdown("Linje 1\nLinje 2")).toContain("Linje 1<br>Linje 2");
  });

  it("strips script tags and event handlers (XSS)", () => {
    const html = renderMarkdown('<script>alert(1)</script><img src="x" onerror="alert(2)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });

  it("strips javascript: URLs in links", () => {
    const html = renderMarkdown('[kobling](javascript:alert(1))');
    expect(html).not.toContain("javascript:");
  });

  it("keeps links with href and target/rel", () => {
    const html = renderMarkdown('[Ekstern](https://example.com)');
    expect(html).toContain('<a href="https://example.com">Ekstern</a>');
  });

  it("allows iframes only with allowed attributes", () => {
    const html = renderMarkdown(
      '<iframe src="https://example.com" allowfullscreen frameborder="0" sandbox="evil"></iframe>'
    );
    expect(html).toContain("<iframe");
    expect(html).toContain("allowfullscreen");
    expect(html).not.toContain("sandbox");
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown(undefined as unknown as string)).toBe("");
  });
});

describe("stripMarkdown", () => {
  it("removes bold and italic markers", () => {
    expect(stripMarkdown("**fet** og *kursiv*")).toBe("fet og kursiv");
  });

  it("removes headings, links, images and code", () => {
    const body = "# Tittel\n[tekst](url) ![alt](bilde.jpg) `kode`";
    expect(stripMarkdown(body)).toBe("Tittel tekst");
  });

  it("removes images without leaving dangling punctuation", () => {
    expect(stripMarkdown("Se bildet: ![Frosta](foto.jpg) her.")).toBe("Se bildet: her.");
  });

  it("removes blockquotes and collapses blank lines", () => {
    expect(stripMarkdown("> sitat\n\nAvsnitt\n\n\nSlutt")).toBe("sitat Avsnitt Slutt");
  });
});

describe("getExcerpt", () => {
  it("truncates at word boundary with ellipsis when over limit", () => {
    const long = "ord ".repeat(50).trim();
    const ex = getExcerpt(long, 30);
    expect(ex.length).toBeLessThanOrEqual(31);
    expect(ex.endsWith("…")).toBe(true);
    expect(ex).not.toContain("ordord");
  });

  it("returns text unchanged when under limit", () => {
    expect(getExcerpt("Kort tekst", 100)).toBe("Kort tekst");
    expect(getExcerpt("Kort tekst", 100).endsWith("…")).toBe(false);
  });

  it("strips markdown before excerpting", () => {
    const ex = getExcerpt("**Fet** start " + "med mer ".repeat(30), 40);
    expect(ex.startsWith("Fet start")).toBe(true);
    expect(ex).not.toContain("**");
  });

  it("returns empty string for empty input", () => {
    expect(getExcerpt("")).toBe("");
  });
});
