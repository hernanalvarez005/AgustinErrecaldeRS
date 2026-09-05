import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Must be created per-request (it closes over the request's
 * cookies), so call this at the top of each server function that needs it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component that can't set cookies directly.
            // Harmless as long as proxy.ts is refreshing the session on every
            // request (see lib/supabase/middleware.ts).
          }
        },
      },
    },
  );
}
