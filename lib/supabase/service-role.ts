import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Service-role Supabase client — bypasses RLS entirely. Only for trusted
 * server-side jobs that have no signed-in user of their own and need to
 * read/write across every organization (currently just the retention-tasks
 * cron, app/api/cron/retention-tasks/route.ts). `SUPABASE_SERVICE_ROLE_KEY`
 * was reserved for exactly this since Phase 0 (.env.example) and unused
 * until now.
 *
 * Never use this for a request made on behalf of a signed-in user — use
 * lib/supabase/server.ts (which respects RLS) for that. This client must
 * never be imported by client-side code or exposed to the browser.
 */
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
