"use server";

import { redirect } from "next/navigation";

import { randomSlugSuffix, slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validations/onboarding";

export async function completeOnboarding(formData: FormData) {
  const parsed = onboardingSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    businessName: formData.get("businessName"),
    phone: formData.get("phone"),
    mainArea: formData.get("mainArea"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const baseSlug = slugify(parsed.data.businessName) || "organizacion";
  const slug = `${baseSlug}-${randomSlugSuffix()}`;

  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.businessName,
    p_slug: slug,
    p_timezone: parsed.data.timezone,
    p_currency: parsed.data.currency,
    p_main_area: parsed.data.mainArea,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_phone: parsed.data.phone,
  });

  if (error) {
    console.error("Failed to create organization:", error.message);
    const message =
      "No pudimos crear tu espacio de trabajo. Intentá nuevamente.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  redirect("/today");
}
