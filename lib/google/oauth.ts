import "server-only";

/**
 * Google OAuth 2.0 (authorization code flow) for Fase 9 — Google Calendar.
 * Never log a request/response body here: they can carry access/refresh
 * tokens (docs/ARCHITECTURE.md, "nunca loguear tokens").
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Least privilege: only this app's own events, not full calendar
// management. `openid email` is only so we can show "conectado como
// x@gmail.com" in Configuración — never used for authorization.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    // Without this, Google only returns a refresh_token the very first
    // time an account authorizes this app — forcing the consent screen
    // guarantees we get one every time, so reconnecting after a revoke
    // never leaves us with an access-only token we can't renew.
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
  token_type: string;
  scope: string;
};

export async function exchangeCodeForTokens(
  code: string,
): Promise<TokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Google token exchange failed with status ${response.status}`,
    );
  }
  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Google token refresh failed with status ${response.status}`,
    );
  }
  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Pulls the email out of the id_token (a JWT) Google returns alongside the
 * access/refresh tokens, without verifying its signature. That's a
 * deliberate simplification, not an oversight: the token came directly
 * from Google's token endpoint over TLS using our own client secret, and
 * the email is only ever used for display ("conectado como x@gmail.com")
 * — never to authorize anything, which is the only case a forged token
 * would matter for.
 */
export function decodeEmailFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}
