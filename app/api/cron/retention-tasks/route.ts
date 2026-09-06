import { NextResponse } from "next/server";

import { generateRetentionTasks } from "@/lib/data/retention";

/**
 * Runs daily (see vercel.json's cron schedule) to create postventa/
 * aniversario/cumpleaños follow-up tasks — see lib/data/retention.ts and
 * docs/ROADMAP.md, Fase 12. A Route Handler, not a Server Action, because
 * this fires from Vercel Cron over plain HTTP with no signed-in user, the
 * same reason app/api/google/callback exists as a Route Handler instead
 * of a Server Action (see docs/ARCHITECTURE.md).
 *
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically on
 * requests it triggers when CRON_SECRET is set as an env var — checking it
 * here stops anyone else from hitting this endpoint and spamming tasks.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counts = await generateRetentionTasks();
  return NextResponse.json({ ok: true, ...counts });
}
