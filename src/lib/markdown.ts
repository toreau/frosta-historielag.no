import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.use({
  breaks: true,
  gfm: true,
});

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "ul", "ol", "li",
  "strong", "em", "a", "code", "pre",
  "blockquote", "img", "table", "thead", "tbody", "tr", "th", "td",
  "div", "span", "iframe",
];

const ALLOWED_ATTR = [
  "href", "src", "alt", "title", "class", "id",
  "target", "rel",
  "width", "height",
  "allow", "allowfullscreen", "frameborder",
];

export function renderMarkdown(body: string | undefined): string {
  if (!body) return "";
  const html = marked.parse(body) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

export function stripMarkdown(body: string): string {
  return body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getExcerpt(body: string | undefined, maxLength: number = 155): string {
  if (!body) return "";
  const plain = stripMarkdown(body);
  if (plain.length <= maxLength) return plain;
  return plain.substring(0, maxLength).replace(/\s+\S*$/, "") + "…";
}
