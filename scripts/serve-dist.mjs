// serve-dist.mjs — zero-dependency static server for the built site (dist/).
//
// Replicates the Cloudflare Pages behaviors the E2E tests depend on, without
// the workerd runtime (which crashes under CI load in `wrangler pages dev`):
//   - applies public/_headers rules (most-specific match wins, `*` wildcards)
//   - applies public/_redirects rules (exact path matches)
//   - 308-redirects no-slash paths to their trailing-slash directory index
//   - serves dist/404.html with status 404 for unknown paths
//
// Usage: node scripts/serve-dist.mjs [--port 4321] [--dir dist]

import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const portArg = args.indexOf("--port");
const PORT = portArg !== -1 ? Number(args[portArg + 1]) : 4321;
const dirArg = args.indexOf("--dir");
const DIST = join(ROOT, dirArg !== -1 ? args[dirArg + 1] : "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".map": "application/json",
};

// --- parse _headers (Cloudflare block syntax) ------------------------------

function parseHeadersFile(raw) {
  // [{ pattern, regex, literalLength, headers: [k, v][] }]
  const rules = [];
  let current = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) {
      current = null;
      continue;
    }
    if (/^\s/.test(line)) {
      const idx = line.indexOf(":");
      if (idx === -1 || !current) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && value) current.headers.push([key, value]);
    } else {
      const pattern = line.trim();
      const regex = new RegExp(
        "^" + pattern.split("*").map(escapeRegExp).join(".*") + "$"
      );
      const literalLength = pattern.replace(/\*.*$/, "").length;
      current = { pattern, regex, literalLength, headers: [] };
      rules.push(current);
    }
  }
  return rules;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchHeaders(rules, pathname) {
  let best = null;
  for (const rule of rules) {
    if (rule.regex.test(pathname) && (!best || rule.literalLength > best.literalLength)) {
      best = rule;
    }
  }
  return best;
}

// --- parse _redirects --------------------------------------------------------

function parseRedirectsFile(raw) {
  // [{ from, to, status }]
  const rules = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    rules.push({
      from: parts[0],
      to: parts[1],
      status: parts.length > 2 ? Number(parts[2]) || 301 : 301,
    });
  }
  return rules;
}

// --- file resolution ---------------------------------------------------------

async function resolveFile(pathname) {
  const rel = normalize(pathname).replace(/^([/\\])+/, "");
  const file = join(DIST, rel);
  try {
    const s = await stat(file);
    if (s.isFile()) return file;
  } catch {
    /* not a file */
  }
  return null;
}

async function resolveIndex(pathname) {
  const rel = normalize(pathname).replace(/^([/\\])+/, "");
  const file = join(DIST, rel, "index.html");
  try {
    const s = await stat(file);
    if (s.isFile()) return file;
  } catch {
    /* no index */
  }
  return null;
}

function send(res, status, headers, body, contentType) {
  res.writeHead(status, { ...headers, "Content-Type": contentType });
  res.end(body);
}

const headersRules = parseHeadersFile(await readFile(join(DIST, "_headers"), "utf8"));
const redirectRules = parseRedirectsFile(await readFile(join(DIST, "_redirects"), "utf8"));

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);

    const redirect = redirectRules.find((r) => r.from === pathname);
    if (redirect) {
      send(res, redirect.status, { Location: redirect.to }, "", "text/plain");
      return;
    }

    const headerRule = matchHeaders(headersRules, pathname);
    const headers = {};
    if (headerRule) {
      for (const [k, v] of headerRule.headers) headers[k] = v;
    }

    let file = await resolveFile(pathname);
    if (!file) {
      const dirIndex = await resolveIndex(pathname);
      if (dirIndex && !pathname.endsWith("/")) {
        // Cloudflare Pages: no-slash path → 308 to trailing-slash URL
        send(
          res,
          308,
          { Location: pathname + "/" + url.search, "Cache-Control": "no-store" },
          "",
          "text/plain"
        );
        return;
      }
      if (dirIndex) file = dirIndex;
    }

    if (!file) {
      const notFound = join(DIST, "404.html");
      try {
        const body = await readFile(notFound);
        res.writeHead(404, { ...headers, "Content-Type": MIME[".html"] });
        res.end(body);
      } catch {
        res.writeHead(404, headers);
        res.end("Not found");
      }
      return;
    }

    const body = req.method === "HEAD" ? null : await readFile(file);
    const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { ...headers, "Content-Type": type });
    res.end(body ?? Buffer.alloc(0));
  } catch (err) {
    console.error("[serve-dist] error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal server error");
    } else {
      res.destroy();
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`serve-dist: http://127.0.0.1:${PORT} -> ${DIST}`);
});
