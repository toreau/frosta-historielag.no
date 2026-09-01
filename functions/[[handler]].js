// Frosta Decap CMS GitHub OAuth proxy (Cloudflare Pages Function).
//
// Security-corrected in APPSEC-01.3a:
//   - DECAP_OAUTH_ORIGIN is the sole authority for the legitimate Decap opener
//     origin (env-only; never Host/query/Referer/opener/cookie-derived).
//   - OAuth state: 32 CSPRNG bytes (256-bit), bound in a short-lived HttpOnly
//     cookie, validated with constant-time comparison, one-time.
//   - PKCE S256: 43-char base64url verifier (32 bytes, no padding), S256
//     challenge, original verifier returned at token exchange.
//   - Exact canonical callback URI used identically in authorize and exchange.
//   - Inbound postMessage handshake validates data + exact origin + opener
//     source; outbound credential messages use the exact origin, never "*".
//   - The GitHub access token is transient only: never logged, never stored,
//     never cached, never sent outside the exact-origin opener.
//   - Callback responses carry no-store, no-referrer, nosniff and a
//     per-response nonce CSP.
//   - Scope is exactly public_repo. GITHUB_REPO_PRIVATE is removed.

const COOKIE_NAME = "__Host-frosta-oauth-state";
const STATE_TTL_SECONDS = 600;
const SCOPE = "public_repo";
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

// ---------------------------------------------------------------------------
// Helpers (exported for focused unit tests)
// ---------------------------------------------------------------------------

export function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function generateCodeVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function deriveCodeChallenge(codeVerifier) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return base64url(new Uint8Array(hash));
}

// Constant-time comparison using Cloudflare's supported crypto.subtle API.
// Both inputs are hashed first so the comparison is over fixed-length digests,
// avoiding a secret-dependent early return on length mismatch.
export async function timingSafeEqualStr(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(new Uint8Array(ha), new Uint8Array(hb));
}

// Validates DECAP_OAUTH_ORIGIN. Returns the normalized origin string or null.
// Production requires an absolute https origin with no userinfo, no path,
// no query, no fragment. An explicitly configured loopback http origin is
// allowed for local development only.
export function validateOrigin(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  let u;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (u.username || u.password) return null;
  if (!u.hostname) return null;
  if (u.pathname !== "/") return null;
  if (u.search !== "" || u.hash !== "") return null;
  const isLoopback = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && isLoopback)) return null;
  return u.origin;
}

function encodeCookieValue(obj) {
  return base64url(new TextEncoder().encode(JSON.stringify(obj)));
}

function decodeCookieValue(value) {
  try {
    let b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    out[name] = value;
  }
  return out;
}

function cookieSet(value, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    maxAge != null ? `Max-Age=${maxAge}` : "Max-Age=0",
  ];
  return parts.join("; ");
}

// The inbound handshake is accepted only when the data, the exact origin and
// the opener source all match.
export function acceptHandshake(data, origin, source, opener, expectedOrigin) {
  return data === "authorizing:github" && origin === expectedOrigin && source === opener;
}

function safeJsString(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Builds the callback page. The bearer token (if any) exists only transiently
// in this response so the exact-origin Decap opener can receive it. It is
// never logged or stored.
export function buildCallbackPage({ type, payload, expectedOrigin }) {
  const nonce = randomHex(16);
  const isSuccess = type === "success";
  const heading = isSuccess ? "Innlogging vellykket" : "Innlogging feilet";
  const message = isSuccess
    ? "Du kan lukke dette vinduet."
    : "GitHub-autentisering feilet. Lukk vinduet og prøv igjen.";
  const originJs = safeJsString(expectedOrigin);
  const resultExpr = isSuccess
    ? `"authorization:github:success:" + ${safeJsString(JSON.stringify(payload))}`
    : `"authorization:github:error:" + ${safeJsString(JSON.stringify({ message: "authentication_failed" }))}`;

  const html = `<!doctype html>
<html lang="no">
<head><meta charset="UTF-8"><title>${heading}</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">
  <h2>${heading}</h2>
  <p>${message}</p>
  <script nonce="${nonce}">
    const expectedOrigin = ${originJs};
    const opener = window.opener;
    const result = ${resultExpr};
    let sent = false;
    function onMessage(event) {
      if (sent) return;
      if (!acceptHandshake(event.data, event.origin, event.source, opener, expectedOrigin)) return;
      sent = true;
      window.removeEventListener("message", onMessage);
      opener.postMessage(result, expectedOrigin);
      setTimeout(function () { try { window.close(); } catch (e) {} }, 500);
    }
    function acceptHandshake(data, origin, source, opener, expectedOrigin) {
      return data === "authorizing:github" && origin === expectedOrigin && source === opener;
    }
    window.addEventListener("message", onMessage);
    if (opener) {
      opener.postMessage("authorizing:github", expectedOrigin);
    }
    setTimeout(function () { try { window.close(); } catch (e) {} }, 10000);
  </script>
</body></html>`;

  return { html, nonce };
}

function callbackResponse(html, nonce) {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    },
  });
}

// ---------------------------------------------------------------------------
// Cloudflare Pages Function entrypoint
// ---------------------------------------------------------------------------

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const expectedOrigin = validateOrigin(env.DECAP_OAUTH_ORIGIN);

  if (url.pathname === "/auth") {
    if (!expectedOrigin) {
      return new Response("OAuth is not configured", { status: 500 });
    }
    if (url.searchParams.get("provider") !== "github") {
      return new Response("Invalid provider", { status: 400 });
    }

    const state = randomHex(32);
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await deriveCodeChallenge(codeVerifier);
    const redirectUri = `${expectedOrigin}/callback`;

    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: SCOPE,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    const authUrl = `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;

    const cookie = cookieSet(
      encodeCookieValue({ state, codeVerifier, iat: Math.floor(Date.now() / 1000) }),
      STATE_TTL_SECONDS,
    );

    return new Response(null, {
      status: 302,
      headers: { Location: authUrl, "Set-Cookie": cookie },
    });
  }

  if (url.pathname === "/callback") {
    if (!expectedOrigin) {
      return new Response("OAuth is not configured", { status: 500 });
    }

    const code = url.searchParams.get("code");
    if (!code) {
      return new Response("Missing code", { status: 400 });
    }

    const cookies = parseCookies(request.headers.get("cookie"));
    const rawCookie = cookies[COOKIE_NAME];
    const stateParam = url.searchParams.get("state");

    const fail = (status) => {
      const headers = { "Set-Cookie": cookieSet("", 0) };
      if (rawCookie) return new Response("Invalid state", { status, headers });
      return new Response("Invalid state", { status });
    };

    if (!rawCookie || !stateParam) {
      return fail(400);
    }
    const stored = decodeCookieValue(rawCookie);
    if (!stored || typeof stored.state !== "string" || typeof stored.codeVerifier !== "string" || typeof stored.iat !== "number") {
      return fail(400);
    }
    const age = Math.floor(Date.now() / 1000) - stored.iat;
    if (age < 0 || age > STATE_TTL_SECONDS) {
      return fail(400);
    }
    if (!(await timingSafeEqualStr(stored.state, stateParam))) {
      return fail(400);
    }

    const redirectUri = `${expectedOrigin}/callback`;
    let token;
    try {
      const resp = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          code_verifier: stored.codeVerifier,
        }),
      });
      if (!resp.ok) throw new Error("token_exchange_http");
      const data = await resp.json();
      if (data.error || typeof data.access_token !== "string" || data.access_token.length === 0) {
        throw new Error("token_exchange_error");
      }
      token = data.access_token;
    } catch {
      // Generic error to the Decap opener; never echo GitHub error text or
      // any credential material. Cookie is consumed (one-time semantics).
      const { html, nonce } = buildCallbackPage({ type: "error", payload: null, expectedOrigin });
      const res = callbackResponse(html, nonce);
      res.headers.set("Set-Cookie", cookieSet("", 0));
      return res;
    }

    const { html, nonce } = buildCallbackPage({
      type: "success",
      payload: { token, provider: "github" },
      expectedOrigin,
    });
    return callbackResponse(html, nonce);
  }

  return next();
}
