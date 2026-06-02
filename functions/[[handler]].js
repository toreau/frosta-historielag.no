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

function callbackPage(type, detail) {
  const success = type === "success";
  const serialized = JSON.stringify(success ? { token: detail, provider: "github" } : { error: detail });
  const prefix = success ? "success" : "error";
  const heading = success ? "✅ Innlogging vellykket" : "❌ Innlogging feilet";
  const message = success
    ? "Du kan lukke dette vinduet."
    : `<pre style="color:#b91c1c;max-width:100%;overflow-x:auto">${detail}</pre>`;

  return new Response(
    `<!doctype html>
<html lang="no">
<head><meta charset="UTF-8"><title>${heading}</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">
  <h2>${heading}</h2>
  <p>${message}</p>
  <script>
    console.log("Decap OAuth callback — ${prefix}:", ${JSON.stringify(detail)});
    const postToken = () => {
      window.opener.postMessage(
        'authorization:github:${prefix}:${serialized.replace(/'/g, "\\'")}',
        '*'
      );
    };
    const receiveMessage = (msg) => {
      if (msg.data === "authorizing:github") {
        window.removeEventListener("message", receiveMessage);
        postToken();
      }
    };
    window.addEventListener("message", receiveMessage);
    window.opener.postMessage("authorizing:github", "*");
    setTimeout(() => { window.close(); }, 10000);
  </script>
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
}

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (url.pathname === "/auth") {
    if (provider !== "github") {
      return new Response("Invalid provider", { status: 400 });
    }
    const redirectUri = `${url.origin}/callback?provider=github`;
    const state = randomHex(4);
    const repoIsPrivate =
      env.GITHUB_REPO_PRIVATE !== undefined &&
      env.GITHUB_REPO_PRIVATE !== "0";
    const repoScope = repoIsPrivate ? "repo,user" : "public_repo,user";
    const authUrl =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${encodeURIComponent(env.GITHUB_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${repoScope}` +
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

  return next();
}
