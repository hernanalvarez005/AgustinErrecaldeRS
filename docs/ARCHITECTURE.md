# Architecture

## Stack y por qué

- **Next.js 16 (App Router, TypeScript, Turbopack).** Next 16 es la versión
  estable actual; trae cambios de ruptura reales respecto a versiones
  anteriores (ver `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`,
  bundleado con el paquete). Los que más afectan a este proyecto:
  - `params`, `searchParams`, `cookies()`, `headers()` son **siempre
    asíncronos** ahora — todo Server Component/Route Handler que los usa hace
    `await`.
  - `middleware.ts` fue renombrado a **`proxy.ts`** (export `proxy`, no
    `middleware`). Ver `proxy.ts` en la raíz.
  - `next lint` fue removido; se usa el ESLint CLI directo (`"lint": "eslint"`
    en package.json, con flat config en `eslint.config.mjs`).
  - Turbopack es el bundler por defecto en `dev` y `build`.
  - Los helpers de tipos `PageProps<'/ruta'>` / `LayoutProps<'/ruta'>` se
    generan automáticamente y se usan en vez de tipar `params`/`searchParams`
    a mano.
- **Supabase** (Postgres + Auth + RLS). Un solo proveedor para datos, auth y
  (a futuro) storage, con migraciones versionadas como fuente de verdad del
  esquema — nunca cambios manuales desde el dashboard.
- **Tailwind CSS v4 + shadcn/ui** (estilo `base-nova`, construido sobre
  **Base UI** — `@base-ui/react` — no Radix). Los componentes viven en
  `components/ui/` y se versionan como código propio, no como dependencia.
- **Zod** para validación de formularios y de los datos que llegan a Server
  Actions, en cliente y servidor.
- **Vercel** para hosting; Preview deployments por PR.

## Multitenancy desde el día uno

Aunque el producto arranca con un solo asesor, todas las tablas de negocio
llevan `organization_id` desde la primera migración. Las primitivas de
tenencia (`organizations`, `memberships`, `profiles`) se implementan en la
Fase 0 — ver docs/DATABASE.md.

**¿Por qué pagar ese costo ahora si hay un solo usuario?** Porque agregar
`organization_id` a posteriori sobre datos ya en producción (con historial
real de contactos/operaciones) es una migración de datos arriesgada, y todo
el resto del modelo (RLS, queries, UI) asume esa columna. Es mucho más barato
modelarlo bien una vez que reescribirlo bajo presión cuando aparezca el
segundo usuario.

**Cómo se mantiene simple para el caso de un solo asesor:** no hay pantallas
de gestión de equipo, invitaciones ni roles granulares en el MVP. El primer
usuario que se registra crea automáticamente su organización (flujo de
onboarding, ver `app/onboarding/`) y queda como único `owner`. La tabla
`memberships` ya soporta N usuarios por organización; simplemente no se
construye la UI para administrarlo todavía.

## Seguridad y RLS

- RLS habilitado en todas las tablas de negocio desde la primera migración.
- **Ninguna tabla de tenencia (`organizations`, `memberships`) acepta INSERT
  directo desde el cliente.** La única forma de crear una organización es la
  función `create_organization()` (SECURITY DEFINER), invocada por el flujo
  de onboarding. Esto cierra la puerta a que un usuario se "auto-invite" a una
  organización ajena insertando una fila de membership con su propio
  `user_id` y un `organization_id` arbitrario.
- `private.user_org_ids()` es una función SECURITY DEFINER que centraliza
  "¿a qué organizaciones pertenece el usuario actual?". Las políticas RLS de
  las tablas de negocio (a partir de la Fase 1) la reutilizan como
  `organization_id in (select private.user_org_ids())` en vez de repetir el
  subquery y arriesgar recursión de RLS sobre `memberships`.
- `profiles` se crea automáticamente vía trigger (`handle_new_user`) en el
  insert de `auth.users` — el cliente nunca inserta un profile directamente.
- El browser nunca ve `SUPABASE_SERVICE_ROLE_KEY` ni secretos de Google.

## Autenticación vs. autorización de Google Calendar

Login de la aplicación (Supabase Auth: email/password + magic link) y la
autorización OAuth de Google Calendar (Fase 9) son conceptualmente
independientes: un usuario puede estar logueado en el CRM sin haber
autorizado Google Calendar, y esa autorización se guarda asociada a su
usuario/organización, no como método de login. Se separan para no acoplar
"puedo entrar al CRM" con "tengo Google conectado".

## Estructura de carpetas

```
app/
  (auth)/login/          # login (password + magic link)
  auth/callback/         # route handler: exchange code for session
  onboarding/             # alta de organización (solo si el usuario no tiene membership)
  (dashboard)/
    today/                # pantalla "Hoy"
    calendar/ contacts/ leads/ properties/ searches/
    acquisitions/ deals/ dashboard/ settings/

components/
  ui/            # shadcn/ui (no editar a mano salvo necesidad puntual)
  auth/          # formularios de login/onboarding
  shared/        # ComingSoon, EmptyState, etc. reutilizados entre módulos
  app-sidebar.tsx / app-header.tsx

lib/
  supabase/      # client.ts (browser), server.ts (RSC/Server Actions), middleware.ts (proxy)
  auth/          # session.ts: getAuthUser/getProfile/getCurrentMembership
  validations/   # esquemas Zod
  slug.ts, utils.ts

types/database.types.ts   # tipos de Supabase (a mano hasta enlazar un proyecto real)

supabase/
  migrations/    # fuente de verdad del esquema
  seed.sql
```

## Decisiones que generan deuda técnica conocida (documentadas a propósito)

- **`types/database.types.ts` está escrito a mano** hasta que el proyecto se
  enlace a una instancia real de Supabase (`supabase link` o `supabase
start` con Docker). A partir de ahí, `npm run db:types` lo regenera y deja
  de mantenerse a mano. Mientras tanto, cualquier cambio de esquema debe
  reflejarse manualmente en este archivo o el type-check no detectará el
  desvío.
- **El checkeo de "¿el usuario tiene organización?" vive en cada layout/página
  que lo necesita** (`getCurrentMembership()`), no en `proxy.ts`. Se decidió
  así para no pagar una consulta a Postgres en cada request de cada ruta
  (proxy corre en runtime `nodejs` para todo, incluyendo assets); el costo es
  que cada punto de entrada nuevo a `(dashboard)/` debe recordar llamarlo (ya
  se centraliza en `app/(dashboard)/layout.tsx`, que es el único punto de
  entrada real hoy).
- **MVP asume una organización por usuario** en varios lugares (`
getCurrentMembership()` hace `.limit(1)`). El esquema soporta N
  organizaciones por usuario desde ya; el día que haga falta, ese helper es
  el único lugar que hay que tocar para dejar de asumirlo.
- **Sin tests automatizados todavía.** Ni Fase 0 ni Fase 1 los tienen — se
  priorizó tener el flujo de punta a punta (auth → onboarding → contactos →
  tareas/notas/actividades → Hoy) funcionando y verificado a mano contra un
  proyecto Supabase real antes de invertir en test harness. Se agregan antes
  de sumar más superficie (Fase 2), sobre todo RLS de `contacts` y el
  cálculo de `contact_overview`, que son los que más cuesta detectar a
  simple vista si se rompen.
- **RLS de Fase 1 sin restricción por fila.** Cualquier miembro de la
  organización puede editar/completar cualquier tarea o nota, no solo la
  propia. Correcto para un asesor solo; el día que haya varios asesores en
  una organización esto necesita revisarse (asignación, permisos por rol)
  antes de ofrecerlo como feature de equipo.

## Gotcha verificado: shadcn `Select` (Base UI) con una sola opción

Encontrado probando el picker de propietarios de una propiedad contra datos
reales: un `<Select>` de shadcn/Base UI con **un solo item** puede mostrar
ese item en el trigger con un solo click (por el posicionamiento
`alignItemWithTrigger`, que superpone el ítem sobre el trigger) sin llegar a
confirmar la selección — el input oculto que alimenta el `FormData` queda
vacío, y el submit no manda nada. Con dos o más items, un click para abrir +
un click sobre el item funciona perfectamente (verificado). La solución no
es una animación ni un `defaultValue`: cuando la lista tiene exactamente un
elemento, no se renderiza el `Select` — se manda un `<input type="hidden">`
con ese único valor y se muestra el nombre como texto plano (ver
`app/(dashboard)/properties/[id]/page.tsx`, selector de propietarios). Si
aparece un nuevo `Select` con una lista que puede tener un solo elemento
(no un enum fijo con 2+ opciones), aplicar el mismo patrón.
