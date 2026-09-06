import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { GOOGLE_OAUTH_STATE_COOKIE } from "@/app/api/google/auth/route";
import { getAuthUser } from "@/lib/auth/session";
import {
  decodeEmailFromIdToken,
  exchangeCodeForTokens,
} from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const consentError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);

  function fail(message: string) {
    return NextResponse.redirect(
      `${origin}/settings?googleError=${encodeURIComponent(message)}`,
    );
  }

  if (consentError) {
    // The advisor declined consent, or Google reported something on its
    // side — not a bug, just an incomplete connection attempt.
    return fail("No se completó la conexión con Google Calendar.");
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail(
      "La conexión con Google Calendar expiró o no es válida. Probá de nuevo.",
    );
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Shouldn't happen with prompt=consent (lib/google/oauth.ts), but if
      // it does we'd store a token with no way to renew it in an hour —
      // better to surface that clearly than silently degrade.
      return fail(
        "Google no devolvió un token de actualización. Revocá el acceso en tu cuenta de Google (myaccount.google.com/permissions) y probá de nuevo.",
      );
    }

    const email = tokens.id_token
      ? decodeEmailFromIdToken(tokens.id_token)
      : null;

    const supabase = await createClient();
    const { error } = await supabase
      .from("google_calendar_connections")
      .upsert({
        user_id: user.id,
        google_email: email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(
          Date.now() + tokens.expires_in * 1000,
        ).toISOString(),
      });
    if (error) {
      console.error(
        "Failed to save Google Calendar connection:",
        error.message,
      );
      return fail("No pudimos guardar la conexión. Intentá nuevamente.");
    }
  } catch (err) {
    console.error(
      "Google Calendar OAuth exchange failed:",
      err instanceof Error ? err.message : err,
    );
    return fail("No pudimos conectar con Google Calendar. Intentá nuevamente.");
  }

  return NextResponse.redirect(`${origin}/settings?google=connected`);
}
