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

export function renderMarkdown(body: string): string {
  if (!body) return "";
  const html = marked.parse(body) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

export function getExcerpt(body: string, maxLength: number = 155): string {
  if (!body) return "";
  const plain = body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/\n{2,}/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  return plain.substring(0, maxLength).replace(/\s+\S*$/, "") + "…";
}
