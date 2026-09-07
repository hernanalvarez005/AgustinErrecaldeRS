import { disconnectGoogleCalendar } from "@/app/(dashboard)/settings/actions";
import { SyncNowButton } from "@/components/settings/sync-now-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMembership, getProfile } from "@/lib/auth/session";
import { getGoogleCalendarConnection } from "@/lib/data/google-calendar";
import { formatDate, formatDateTime } from "@/lib/format";

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  member: "Miembro",
};

export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const params = await searchParams;
  const connectedNotice = params.google === "connected";
  const googleError =
    typeof params.googleError === "string" ? params.googleError : undefined;

  const [profile, membership, googleConnection] = await Promise.all([
    getProfile(),
    getCurrentMembership(),
    getGoogleCalendarConnection(),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>

      <Card>
        <CardHeader>
          <CardTitle>Tu perfil</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Nombre</dt>
            <dd>
              {[profile?.first_name, profile?.last_name]
                .filter(Boolean)
                .join(" ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd>{profile?.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rol</dt>
            <dd>
              {membership
                ? (ROLE_LABELS[membership.role] ?? membership.role)
                : "—"}
            </dd>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organización</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Nombre comercial</dt>
            <dd>{membership?.organization.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Zona principal</dt>
            <dd>{membership?.organization.main_area || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Moneda</dt>
            <dd>{membership?.organization.currency || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Zona horaria</dt>
            <dd>{membership?.organization.timezone || "—"}</dd>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {connectedNotice ? (
            <div className="border-success/30 bg-success/10 text-success rounded-md border px-3 py-2">
              Conectado correctamente.
            </div>
          ) : null}
          {googleError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2">
              {googleError}
            </div>
          ) : null}
          {googleConnection ? (
            <>
              <p>
                Conectado como{" "}
                <span className="font-medium">
                  {googleConnection.google_email ?? "cuenta de Google"}
                </span>
                {googleConnection.created_at
                  ? ` · desde ${formatDate(googleConnection.created_at)}`
                  : ""}
              </p>
              <p className="text-muted-foreground">
                Los eventos que agendes en la Agenda del CRM se copian a este
                calendario de Google, y los que crees o edites directamente en
                Google Calendar se importan al CRM como eventos externos al
                sincronizar — nunca crean automáticamente un contacto, propiedad
                o tarea.
              </p>
              <p className="text-muted-foreground">
                Última sincronización:{" "}
                {googleConnection.last_synced_at
                  ? formatDateTime(googleConnection.last_synced_at)
                  : "todavía no se sincronizó"}
              </p>
              <div className="flex flex-wrap gap-2">
                <SyncNowButton />
                <form action={disconnectGoogleCalendar}>
                  <Button type="submit" variant="outline" size="sm">
                    Desconectar
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Conectá tu cuenta de Google para que los eventos que agendes en
                la Agenda del CRM aparezcan también en tu Google Calendar.
              </p>
              <Button
                render={<a href="/api/google/auth" />}
                nativeButton={false}
              >
                Conectar Google Calendar
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        La edición de estos datos se agrega en una fase posterior (ver
        docs/ROADMAP.md).
      </p>
    </div>
  );
}
