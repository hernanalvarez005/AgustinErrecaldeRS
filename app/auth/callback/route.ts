import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the code from a magic-link / signup confirmation email for a
 * session. See docs/ARCHITECTURE.md for why this lives outside (auth)/(dashboard)
 * route groups: it's a Route Handler, not a page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const message = encodeURIComponent(
    "No pudimos confirmar el acceso. Probá de nuevo.",
  );
  return NextResponse.redirect(`${origin}/login?error=${message}`);
}
