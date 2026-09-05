import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMembership, getProfile } from "@/lib/auth/session";

export default async function TodayPage() {
  const [profile, membership] = await Promise.all([
    getProfile(),
    getCurrentMembership(),
  ]);
  const firstName = profile?.first_name || "de nuevo";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Buenos días, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm">
          {membership?.organization.name} ·{" "}
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Agenda de hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Todavía no hay eventos. La agenda se implementa en la Fase 8.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Tareas para hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Todavía no hay tareas. Se implementan en la Fase 1.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Seguimientos vencidos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Sin datos todavía.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Alertas comerciales
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Sin datos todavía.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
