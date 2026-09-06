"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  magicLinkSchema,
  passwordSignInSchema,
  passwordSignUpSchema,
} from "@/lib/validations/auth";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function failLogin(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function signInWithPassword(formData: FormData) {
  const parsed = passwordSignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    failLogin(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    console.error("Sign in failed:", error.code, error.message);
    if (error.code === "email_not_confirmed") {
      failLogin(
        "Todavía no confirmaste tu email. Revisá tu casilla y hacé click en el link de confirmación.",
      );
    }
    failLogin("No pudimos iniciar sesión. Revisá tu email y contraseña.");
  }

  const redirectTo = formData.get("redirectTo");
  redirect(
    typeof redirectTo === "string" && redirectTo ? redirectTo : "/today",
  );
}

export async function signUpWithPassword(formData: FormData) {
  const parsed = passwordSignUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    failLogin(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) {
    console.error("Sign up failed:", error.code, error.message);
    failLogin("No pudimos crear la cuenta. Probá con otro email.");
  }

  // If email confirmation is disabled on the project, signUp already
  // returns an active session — no point telling the user to check an
  // email that won't matter.
  if (data.session) {
    redirect("/today");
  }

  redirect(
    `/login?message=${encodeURIComponent("Revisá tu email para confirmar la cuenta.")}`,
  );
}

export async function sendMagicLink(formData: FormData) {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    failLogin(parsed.error.issues[0]?.message ?? "Ingresá un email válido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) {
    console.error("Magic link failed:", error.code, error.message);
    failLogin("No pudimos enviar el link de acceso. Intentá nuevamente.");
  }

  redirect(
    `/login?message=${encodeURIComponent("Te enviamos un link de acceso a tu email.")}`,
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
