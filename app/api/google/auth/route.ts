import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentMembership } from "@/lib/auth/session";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";

/** The cookie name is shared with the callback route, which reads and clears it. */
export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

/**
 * Kicks off Google's OAuth consent screen from Configuración → "Conectar
 * Google Calendar". A Route Handler, not a Server Action, because OAuth
 * needs a real HTTP redirect to a different origin — see
 * app/auth/callback/route.ts for the analogous Supabase magic-link case.
 */
export async function GET(request: Request) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // CSRF protection: the callback only proceeds if the `state` it receives
  // matches this cookie, so a request forged by another site can't complete
  // the flow and attach its own Google account to this session.
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
