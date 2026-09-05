import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const message =
    typeof params.message === "string" ? params.message : undefined;
  const redirectTo =
    typeof params.redirectTo === "string" ? params.redirectTo : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          CRM Inmobiliario
        </h1>
        <p className="text-muted-foreground text-sm">
          Ingresá para gestionar tu operación comercial.
        </p>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="border-primary/30 bg-primary/10 rounded-md border px-3 py-2 text-sm">
          {message}
        </div>
      ) : null}

      <LoginForm redirectTo={redirectTo} />
    </div>
  );
}
