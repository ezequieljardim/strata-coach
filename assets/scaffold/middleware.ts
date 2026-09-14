/**
 * Password gate at the edge, before any file is served.
 *
 * It exists because on the Vercel Hobby plan the native protection does not cover the
 * production domain. And since the data is compiled into the bundle, a client-side password
 * would be useless: the cut has to happen here.
 *
 * One password for the whole site, every athlete included: this is meant for a family or a
 * group of friends who can see each other's data.
 *
 * After a valid basic auth it sets a signed session cookie (1 year) so the password isn't
 * typed on every visit. The cookie doesn't store the password: it stores a SHA-256 of
 * user+password, so changing SITE_PASSWORD invalidates every open session.
 *
 * Configure in Vercel → Settings → Environment Variables:
 *   SITE_USER      (optional, defaults to "coach")
 *   SITE_PASSWORD  (required; without it the site is open)
 */

export const config = {
  // Everything is protected except the icons and the manifest, which iOS requests without
  // credentials when adding the app to the home screen.
  matcher: "/((?!favicon-32\\.png|apple-touch-icon\\.png|icon-192\\.png|icon-512\\.png|manifest\\.webmanifest|robots\\.txt).*)",
};

// Cookie and marker names are kept from the first deploy: renaming them would log
// everyone out for no gain.
const COOKIE = "sfauth";
const ONE_YEAR = 60 * 60 * 24 * 365;

// URL marker to avoid a redirect loop when the browser blocks cookies.
const MARKER = "_sfa";

function askPassword() {
  return new Response("Restricted.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Running plan", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function redirect(to: URL, cookie?: string) {
  const headers = new Headers({
    location: to.toString(),
    "Cache-Control": "no-store",
  });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

async function token(user: string, password: string) {
  const data = new TextEncoder().encode(`${user}:${password}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const expected = process.env.SITE_PASSWORD;

  // No variable configured → no gate: avoids locking the owner out locally or on a first
  // deploy. Set it and the site is closed.
  if (!expected) return;

  const expectedUser = process.env.SITE_USER ?? "coach";
  const valid = await token(expectedUser, expected);

  const url = new URL(request.url);
  const hasMarker = url.searchParams.has(MARKER);

  const cookies = request.headers.get("cookie") ?? "";
  if (cookies.split("; ").includes(`${COOKIE}=${valid}`)) {
    // Good session: if we're coming from the login redirect, drop the marker.
    if (!hasMarker) return;
    url.searchParams.delete(MARKER);
    return redirect(url);
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return askPassword();

  let plain: string;
  try {
    plain = atob(header.slice(6));
  } catch {
    return askPassword();
  }

  const cut = plain.indexOf(":");
  if (cut < 0) return askPassword();

  if (plain.slice(0, cut) !== expectedUser || plain.slice(cut + 1) !== expected) {
    return askPassword();
  }

  // Correct password. Set the cookie on the main navigation; subresources (js, css, json)
  // just pass: the browser already sends basic auth.
  const isNavigation = request.headers.get("sec-fetch-dest") === "document";
  if (!isNavigation || hasMarker) return;

  url.searchParams.set(MARKER, "1");
  return redirect(
    url,
    `${COOKIE}=${valid}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; Secure; SameSite=Lax`,
  );
}
