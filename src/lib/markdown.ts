import { marked } from "marked";

export function renderMarkdown(body: string): string {
  return body ? marked.parse(body) as string : "";
}
