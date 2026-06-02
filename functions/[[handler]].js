function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function exchangeCode(code, id, secret) {
  const resp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      code,
    }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

function htmlResponse(body) {
  return new Response(body, { headers: { "Content-Type": "text/html" } });
}

function callbackPage(status, token) {
  const serialized = JSON.stringify({ token, provider: "github" });
  return htmlResponse(`<!doctype html>
<html><head><script>
  const receiveMessage = (message) => {
    window.opener.postMessage(
      'authorization:github:${status}:${serialized}',
      '*'
    );
    window.removeEventListener("message", receiveMessage, false);
  };
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
</script></head>
<body><p>Authorizing…</p></body></html>`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    const provider = url.searchParams.get("provider");

    if (url.pathname === "/auth") {
      if (provider !== "github") {
        return new Response("Invalid provider", { status: 400 });
      }
      const redirectUri = `${origin}/callback?provider=github`;
      const state = randomHex(4);
      const authUrl =
        `https://github.com/login/oauth/authorize` +
        `?client_id=${encodeURIComponent(env.GITHUB_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=public_repo,user` +
        `&state=${state}`;

      return new Response(null, {
        status: 302,
        headers: { Location: authUrl },
      });
    }

    if (url.pathname === "/callback") {
      if (provider !== "github") {
        return new Response("Invalid provider", { status: 400 });
      }

      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Missing code", { status: 400 });
      }

      try {
        const token = await exchangeCode(
          code,
          env.GITHUB_CLIENT_ID,
          env.GITHUB_CLIENT_SECRET
        );
        return callbackPage("success", token);
      } catch (err) {
        return callbackPage("error", String(err));
      }
    }

    return env.ASSETS.fetch(request);
  },
};
