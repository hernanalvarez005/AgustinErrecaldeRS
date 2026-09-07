# CRM Inmobiliario

CRM para asesores inmobiliarios: contactos, propiedades, captaciones, búsquedas,
leads y operaciones en un solo lugar, con una pantalla "Hoy" como centro de
trabajo diario. Pensado para un asesor individual desde el día uno, con una
arquitectura multitenant que permite crecer a equipos/inmobiliarias sin
reescribir el modelo de datos.

Ver [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) para el detalle funcional
completo, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para las decisiones
técnicas, [docs/DATABASE.md](docs/DATABASE.md) para el esquema, y
[docs/ROADMAP.md](docs/ROADMAP.md) para las fases de implementación.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript, Turbopack)
- [Supabase](https://supabase.com) (PostgreSQL, Auth, RLS, Storage cuando corresponda)
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Zod](https://zod.dev) para validación
- [Vercel](https://vercel.com) para hosting

## Instalación

```bash
npm install
```

Node.js 20.9+ requerido (ver `node -v`).

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores:

```bash
cp .env.example .env.local
```

| Variable                                                            | Descripción                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                          | URL del proyecto Supabase (dashboard o `supabase status` local)                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                     | Clave anónima (pública) del proyecto                                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`                                         | Solo servidor, nunca exponerla al navegador ni commitearla. La usa el cron de retención (Fase 12) para bypassear RLS  |
| `NEXT_PUBLIC_SITE_URL`                                              | Base URL usada para links de magic link / confirmación de email — en producción, la URL real de Vercel                |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | OAuth de Google Calendar (Fase 9). `GOOGLE_REDIRECT_URI` debe coincidir exacto con lo cargado en Google Cloud Console |
| `CRON_SECRET`                                                       | Bearer token que Vercel Cron manda al pegarle a `/api/cron/retention-tasks` (Fase 12) — cualquier string random       |

## Supabase: setup local

Este proyecto usa Supabase CLI con migraciones versionadas en `supabase/migrations/`
como fuente de verdad del esquema (nunca se edita el esquema a mano desde el
dashboard).

**Opción A — Supabase local con Docker (recomendado para desarrollo):**

```bash
npx supabase start      # requiere Docker Desktop corriendo
npx supabase db reset   # aplica todas las migraciones + supabase/seed.sql
```

`supabase start` imprime la URL y anon key locales — pegalas en `.env.local`.

**Opción B — Proyecto Supabase hosteado:**

```bash
npx supabase link --project-ref <tu-project-ref>
npx supabase db push    # aplica las migraciones pendientes al proyecto remoto
```

Copiá la URL y anon key desde Project Settings → API en el dashboard de Supabase
a `.env.local`.

### Generar tipos TypeScript desde el esquema

```bash
npm run db:types
```

Regenera `types/database.types.ts` a partir del esquema real (requiere
`supabase start` corriendo). Hasta que el proyecto esté enlazado, ese archivo
está escrito a mano y debe mantenerse sincronizado manualmente con las
migraciones — ver el comentario en el propio archivo.

### Nueva migración

```bash
npx supabase migration new nombre_descriptivo
```

Nunca modificar una migración ya aplicada en un entorno compartido: crear una
migración nueva.

## Desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Calidad

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format      # Prettier (--write)
npm run build       # build de producción (Turbopack)
```

## Despliegue (Vercel)

1. Importar el repositorio en Vercel (Next.js se detecta solo, no hace
   falta configurar build command ni output directory).
2. Configurar las variables de entorno de la tabla de arriba para
   Production (y Preview/Development si se van a usar) — `SUPABASE_SERVICE_ROLE_KEY`
   y los secretos de Google solo como server-side, nunca con el prefijo
   `NEXT_PUBLIC_`.
3. Después del primer deploy, Vercel asigna un dominio
   (`<proyecto>.vercel.app` o uno propio). Con ese dominio ya conocido:
   - Actualizar `NEXT_PUBLIC_SITE_URL` y `GOOGLE_REDIRECT_URI`
     (`https://<dominio>/api/google/callback`) en las variables de
     entorno de Vercel, y volver a desplegar (un cambio de variable de
     entorno no aplica solo, necesita un nuevo deploy).
   - Agregar `https://<dominio>/api/google/callback` a "Authorized
     redirect URIs" en el cliente OAuth de Google Cloud Console (además
     del de `localhost`, que puede quedar para seguir probando en local).
   - Agregar `https://<dominio>` a Supabase → Authentication → URL
     Configuration → Site URL / Redirect URLs (si no está, el magic link
     y la confirmación de signup redirigen mal en producción).
4. El cron de `vercel.json` (`/api/cron/retention-tasks`) se activa solo
   al desplegar — se puede verificar en la pestaña "Cron Jobs" del
   proyecto en Vercel, y disparar a mano desde ahí para probarlo sin
   esperar al horario programado.

## Arquitectura y decisiones

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
