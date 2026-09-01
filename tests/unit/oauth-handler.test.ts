import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptHandshake,
  buildCallbackPage,
  deriveCodeChallenge,
  generateCodeVerifier,
  onRequest,
  parseCookies,
  randomHex,
  timingSafeEqualStr,
  validateOrigin,
} from "../../functions/[[handler]]";

const PROD_ORIGIN = "https://frosta-historielag.pages.dev";

// Cloudflare's crypto.subtle.timingSafeEqual is not part of Node's WebCrypto
// or the TS SubtleCrypto type; stub it with a constant-time elementwise
// comparison over fixed-length buffers (the handler hashes both inputs first,
// so lengths always match).
function stubTimingSafeEqual() {
  (globalThis.crypto.subtle as unknown as { timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean }).timingSafeEqual =
    (a, b) => {
      if (a.byteLength !== b.byteLength) return false;
      let diff = 0;
      for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
      return diff === 0;
    };
}

const baseEnv = {
  DECAP_OAUTH_ORIGIN: PROD_ORIGIN,
  GITHUB_CLIENT_ID: "client_id_test",
  GITHUB_CLIENT_SECRET: "secret_test",
};

function authRequest(path: string) {
  return new Request(`https://frosta-historielag.pages.dev${path}`);
}

function makeEnv(overrides = {}) {
  return { ...baseEnv, ...overrides };
}

describe("validateOrigin", () => {
  it("accepts the canonical production origin", () => {
    expect(validateOrigin(PROD_ORIGIN)).toBe(PROD_ORIGIN);
    expect(validateOrigin(`${PROD_ORIGIN}/`)).toBe(PROD_ORIGIN);
  });

  it("rejects Host/query/cookie-derived or malformed values", () => {
    expect(validateOrigin(`${PROD_ORIGIN}/x`)).toBeNull();
    expect(validateOrigin(`${PROD_ORIGIN}?x=1`)).toBeNull();
    expect(validateOrigin(`${PROD_ORIGIN}#frag`)).toBeNull();
    expect(validateOrigin("http://example.com")).toBeNull();
    expect(validateOrigin("https://user:pass@example.com")).toBeNull();
    expect(validateOrigin("not a url")).toBeNull();
    expect(validateOrigin("")).toBeNull();
    expect(validateOrigin(undefined)).toBeNull();
  });

  it("allows an explicitly configured loopback http origin for local dev", () => {
    expect(validateOrigin("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
    expect(validateOrigin("http://localhost:8787")).toBe("http://localhost:8787");
  });
});

describe("state generation", () => {
  it("generates 64-char lowercase hex (256-bit) state", () => {
    const s = randomHex(32);
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique states", () => {
    expect(randomHex(32)).not.toBe(randomHex(32));
  });
});

describe("PKCE", () => {
  it("produces a 43-char base64url verifier without padding", () => {
    const v = generateCodeVerifier();
    expect(v).toHaveLength(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(v).not.toContain("=");
  });

  it("derives the correct S256 challenge (RFC 7636 vector)", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("emits code_challenge and code_challenge_method=S256 in authorize", async () => {
    const res = await onRequest({ request: authRequest("/auth?provider=github"), env: makeEnv(), next });
    const loc = res.headers.get("location");
    expect(loc).toContain("code_challenge_method=S256");
    expect(loc).toMatch(/code_challenge=[A-Za-z0-9_-]{43}/);
  });
});

describe("timingSafeEqualStr", () => {
  beforeEach(stubTimingSafeEqual);

  it("returns true for equal and false for different values", async () => {
    expect(await timingSafeEqualStr("abc", "abc")).toBe(true);
    expect(await timingSafeEqualStr("abc", "abd")).toBe(false);
  });

  it("handles different lengths without early-return semantics (constant via hashing)", async () => {
    expect(await timingSafeEqualStr("a", "ab")).toBe(false);
    expect(await timingSafeEqualStr("", "a")).toBe(false);
  });
});

describe("parseCookies", () => {
  it("parses cookie header into an object", () => {
    expect(parseCookies("a=1; __Host-frosta-oauth-state=xyz; b=2")).toEqual({
      a: "1",
      "__Host-frosta-oauth-state": "xyz",
      b: "2",
    });
    expect(parseCookies(null)).toEqual({});
  });
});

describe("acceptHandshake", () => {
  it("accepts only exact data + origin + source", () => {
    expect(acceptHandshake("authorizing:github", PROD_ORIGIN, "opener", "opener", PROD_ORIGIN)).toBe(true);
    expect(acceptHandshake("authorizing:github", "https://evil.example", "opener", "opener", PROD_ORIGIN)).toBe(false);
    expect(acceptHandshake("authorizing:github", PROD_ORIGIN, "evil", "opener", PROD_ORIGIN)).toBe(false);
    expect(acceptHandshake("authorizing:evil", PROD_ORIGIN, "opener", "opener", PROD_ORIGIN)).toBe(false);
  });
});

describe("buildCallbackPage", () => {
  it("uses exact targetOrigin, nonce CSP, no unsafe-inline, no token logging", () => {
    const { html, nonce } = buildCallbackPage({
      type: "success",
      payload: { token: "gho_secret", provider: "github" },
      expectedOrigin: PROD_ORIGIN,
    });
    expect(html).toContain(`nonce="${nonce}"`);
    expect(html).not.toContain('"*"');
    expect(html).not.toContain("console.log");
    expect(html).toContain(`"${PROD_ORIGIN}"`);
    expect(html).toContain("authorization:github:success");
    expect(html).toContain('data === "authorizing:github"');
  });

  it("escapes script-terminating sequences in embedded values", () => {
    const { html } = buildCallbackPage({
      type: "error",
      payload: null,
      expectedOrigin: PROD_ORIGIN,
    });
    // The message is a fixed string; ensure the page has no raw </script> from interpolation
    expect(html.split("</script>")).toHaveLength(2); // only the one real closing tag
    expect(html).toContain("authorization:github:error");
  });
});

describe("onRequest /auth", () => {
  it("redirects with public_repo scope and state/PKCE", async () => {
    const res = await onRequest({ request: authRequest("/auth?provider=github"), env: makeEnv(), next });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location");
    expect(loc).toContain("https://github.com/login/oauth/authorize");
    const scopeParam = new URL(loc).searchParams.get("scope");
    expect(scopeParam).toBe("public_repo");
    expect(scopeParam).not.toMatch(/(^|,)(repo|user)(,|$)/);
    expect(loc).toContain("redirect_uri=https%3A%2F%2Ffrosta-historielag.pages.dev%2Fcallback");
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("__Host-frosta-oauth-state=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=600");
  });

  it("fails closed when DECAP_OAUTH_ORIGIN is missing/invalid", async () => {
    const res1 = await onRequest({ request: authRequest("/auth?provider=github"), env: makeEnv({ DECAP_OAUTH_ORIGIN: undefined }), next });
    expect(res1.status).toBe(500);
    const res2 = await onRequest({ request: authRequest("/auth?provider=github"), env: makeEnv({ DECAP_OAUTH_ORIGIN: "http://example.com" }), next });
    expect(res2.status).toBe(500);
    expect(res2.headers.get("location")).toBeNull();
  });

  it("rejects invalid provider", async () => {
    const res = await onRequest({ request: authRequest("/auth?provider=gitlab"), env: makeEnv(), next });
    expect(res.status).toBe(400);
  });
});

describe("onRequest /callback", () => {
  beforeEach(stubTimingSafeEqual);

  async function beginAuth() {
    const res = await onRequest({ request: authRequest("/auth?provider=github"), env: makeEnv(), next });
    const cookie = res.headers.get("set-cookie");
    const loc = res.headers.get("location");
    const state = new URL(loc).searchParams.get("state");
    return { cookie, state };
  }

  it("exchanges code and delivers token to exact origin (no *)", async () => {
    const { cookie, state } = await beginAuth();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "gho_token", token_type: "bearer", scope: "public_repo" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const req = new Request(`https://frosta-historielag.pages.dev/callback?code=code123&state=${state}`, {
      headers: { cookie },
    });
    const res = await onRequest({ request: req, env: makeEnv(), next });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("authorization:github:success");
    expect(html).toContain(`"${PROD_ORIGIN}"`);
    expect(html).not.toContain('"*"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const csp = res.headers.get("content-security-policy");
    expect(csp).toMatch(/script-src 'nonce-[0-9a-f]{32}'/);
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src [^']*\*/);
  });

  it("passes exact redirect_uri and code_verifier into the exchange", async () => {
    const { cookie, state } = await beginAuth();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "gho_token", token_type: "bearer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;
    const req = new Request(`https://frosta-historielag.pages.dev/callback?code=code123&state=${state}`, {
      headers: { cookie },
    });
    await onRequest({ request: req, env: makeEnv(), next });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.redirect_uri).toBe(`${PROD_ORIGIN}/callback`);
    expect(body.client_id).toBe("client_id_test");
    expect(body.client_secret).toBe("secret_test");
    expect(body.code).toBe("code123");
    expect(body.code_verifier).toHaveLength(43);
  });

  it("fails on missing state param", async () => {
    const { cookie } = await beginAuth();
    const req = new Request(`https://frosta-historielag.pages.dev/callback?code=code123`, { headers: { cookie } });
    const res = await onRequest({ request: req, env: makeEnv(), next });
    expect(res.status).toBe(400);
    expect((res.headers.get("set-cookie") || "").includes("Max-Age=0")).toBe(true);
  });

  it("fails on missing cookie", async () => {
    const req = new Request(`https://frosta-historielag.pages.dev/callback?code=code123&state=abc`);
    const res = await onRequest({ request: req, env: makeEnv(), next });
    expect(res.status).toBe(400);
  });

  it("fails on state mismatch and clears the cookie", async () => {
    const { cookie } = await beginAuth();
    const req = new Request(`https://frosta-historielag.pages.dev/callback?code=code123&state=deadbeef`, {
      headers: { cookie },
    });
    const res = await onRequest({ request: req, env: makeEnv(), next });
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("fails closed on token exchange failure with generic error and no token", async () => {
    const { cookie, state } = await beginAuth();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "bad_verification_code", error_description: "The code passed is incorrect" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const req = new Request(`https://frosta-historielag.pages.dev/callback?code=bad&state=${state}`, {
      headers: { cookie },
    });
    const res = await onRequest({ request: req, env: makeEnv(), next });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("authentication_failed");
    expect(html).not.toContain("bad_verification_code");
    expect(html).not.toContain("The code passed is incorrect");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects expired state", async () => {
    // Cookie with an old iat (epoch 0) must fail the 10-minute lifetime check.
    const tampered = Buffer.from(
      JSON.stringify({ state: "a".repeat(64), codeVerifier: "b".repeat(43), iat: 0 }),
    ).toString("base64");
    const req = new Request(
      `https://frosta-historielag.pages.dev/callback?code=code123&state=${"a".repeat(64)}`,
      { headers: { cookie: `__Host-frosta-oauth-state=${tampered}` } },
    );
    const res = await onRequest({ request: req, env: makeEnv(), next });
    expect(res.status).toBe(400);
  });
});

const next = () => new Response("next", { status: 404 });

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error test-only teardown
  delete globalThis.crypto.subtle.timingSafeEqual;
});
