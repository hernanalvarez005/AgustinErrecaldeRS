import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMembership, getProfile } from "@/lib/auth/session";

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  member: "Miembro",
};

export default async function SettingsPage() {
  const [profile, membership] = await Promise.all([
    getProfile(),
    getCurrentMembership(),
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

      <p className="text-muted-foreground text-xs">
        La edición de estos datos y la conexión con Google Calendar se agregan
        en fases posteriores (ver docs/ROADMAP.md).
      </p>
    </div>
  );
}
