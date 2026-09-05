import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getAuthUser, getCurrentMembership } from "@/lib/auth/session";

export default async function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const membership = await getCurrentMembership();
  if (membership) redirect("/today");

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="bg-muted/30 flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Bienvenido</h1>
          <p className="text-muted-foreground text-sm">
            Contanos un poco sobre tu operación para configurar tu espacio de
            trabajo.
          </p>
        </div>

        {error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}

        <OnboardingForm />
      </div>
    </div>
  );
}
