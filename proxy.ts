import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Renamed from `middleware.ts` in Next.js 16 — see
// node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - files with an extension (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.[\\w]+$).*)",
  ],
};
