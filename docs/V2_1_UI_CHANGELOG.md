# V2.1 — Changelog visual

Registro de qué cambió pantalla por pantalla, Bloque por Bloque. Ver
`docs/V2_1_UI_AUDIT.md` para el diagnóstico previo y `docs/DESIGN_SYSTEM.md`
para la fuente de verdad de tokens/componentes.

## Bloque UI-1 — Foundation

**Qué cambió:**

- [app/globals.css](../app/globals.css):
  - `--background` pasa de blanco puro a un gris extremadamente sutil
    (`#F8F9FB`), separando visualmente canvas de superficie (`--card` sigue
    blanco puro) — punto 9 de la spec.
  - `--primary` pasa de gris neutro (sin marca) a azul profesional
    (`#2563EB` en light, variante más clara en dark) — no existía un color
    de marca previo (ver auditoría), así que no se conservó nada, se adoptó
    de cero.
  - `--ring` y `--sidebar-ring` ahora usan `var(--primary)` — foco visible en
    azul en toda la app (antes gris).
  - `--sidebar-accent`/`--sidebar-accent-foreground` (hover + activo del
    nav) ahora resuelven a un wash sutil de `--primary` en vez de gris
    plano — el ítem activo del sidebar ya se distingue con color, no solo
    con posición.
  - Nuevos tokens semánticos: `--success`, `--warning`, `--danger` (alias de
    `--destructive`), `--neutral` (alias de `--muted-foreground`), cada uno
    con su `-foreground`, expuestos a Tailwind como `bg-success`,
    `text-warning`, etc. vía `@theme inline`.
  - Nuevo `--border-strong` para dividers con más énfasis (sin uso todavía
    — reservado para Bloques posteriores).
- [lib/status-tone.ts](../lib/status-tone.ts) (nuevo): mapeo
  status→significado por dominio (captación, operación, oferta, búsqueda,
  lead, propiedad, recomendación, actividad, prioridad de tarea), con
  chequeo de exhaustividad en tiempo de compilación.
- [components/shared/status-badge.tsx](../components/shared/status-badge.tsx)
  (nuevo): badge con color semántico, mismo lenguaje visual que el `Badge`
  existente (`bg-x/10 text-x`). **Todavía no conectado a ninguna pantalla**
  — se conecta pantalla por pantalla en los Bloques UI-3 a UI-6, donde de
  todos modos hay que tocar cada `page.tsx` para el resto del rediseño de
  esa pantalla. Conectarlo ahora habría significado tocar 17 archivos fuera
  del alcance de "foundation".
- [components/ui/card.tsx](../components/ui/card.tsx): `CardTitle` unifica
  su estilo por defecto a `text-sm font-semibold` (antes `text-base
font-medium`, sistemáticamente sobreescrito por cada consumidor a algo
  distinto — ver inconsistencia #3 de la auditoría). Cambio no disruptivo:
  todo call site existente ya renderizaba texto pequeño, ahora es
  consistente sin necesidad de className repetido.
- [app/(dashboard)/settings/page.tsx](<../app/(dashboard)/settings/page.tsx>):
  el aviso "Conectado correctamente" de Google Calendar pasa de
  `emerald-500` hardcodeado a `bg-success/10 text-success` — primer uso real
  del nuevo token, mismo patrón que el aviso de error ya usaba con
  `destructive`.

**Componentes nuevos:** `StatusBadge` (`components/shared/status-badge.tsx`).

**Componentes eliminados:** ninguno.

**Decisiones visuales:**

- Azul `#2563EB` como primary: no había marca establecida (confirmado en la
  auditoría — grep sobre `docs/*.md` y `app/layout.tsx` sin resultados), así
  que se tomó la dirección conceptual sugerida por la spec sin modificarla.
- Tonos semánticos como _significado_, no _enum_: cada dominio tiene su
  propia función en `lib/status-tone.ts` en vez de un mapeo global
  string→color, porque el mismo string (`"active"`, `"new"`) significa cosas
  distintas según el dominio.
- `--danger`/`--neutral` son alias de tokens ya existentes
  (`--destructive`/`--muted-foreground`) en vez de colores nuevos, para no
  duplicar semántica que ya estaba bien resuelta.
- Hover states siguen usando modificadores de opacidad
  (`hover:bg-primary/80`) en vez de tokens `-hover` dedicados, siguiendo el
  patrón que el propio `button.tsx` ya usaba antes de este Bloque.

**Pantallas modificadas:** ninguna pantalla de negocio todavía — solo
`app/globals.css` (global), `components/ui/card.tsx` (compartido) y
`app/(dashboard)/settings/page.tsx` (un solo bloque de texto). El resto de
las pantallas heredan los cambios de token automáticamente (canvas, primary,
focus ring, sidebar) sin haber sido tocadas.

**Responsive:** sin cambios de layout en este Bloque — solo color/tipografía
a nivel de token, no hay nada que romper en mobile que no aplique también a
desktop. Verificación real de mobile queda para Bloque UI-8.

**Charts:** sin cambios — Bloque UI-7.

**Deuda pendiente / seguimiento:**

- `StatusBadge` existe pero no está conectado a ninguna pantalla todavía —
  se conecta Bloque a Bloque a medida que se tocan las pantallas
  correspondientes (ver arriba).
- La jerarquía de botones (CTA real en `variant="outline"` en vez de
  `variant="default"`) sigue sin corregirse — es un cambio por pantalla, no
  de foundation, se resuelve en los Bloques UI-3 a UI-6.
- `--border-strong` está definido pero sin ningún uso real todavía.
- `docs/V2_1_FOLLOWUPS.md` no tiene entradas nuevas — no se encontraron bugs
  funcionales durante este Bloque, solo el estilo del aviso de Google
  Calendar (visual, ya corregido arriba).

**Verificación:** `npm run typecheck`, `npm run lint`, `npm run build` y
`npm run format` corridos sin errores. Verificado en vivo contra
`localhost:3000` (misma base de Supabase hosteada) con sesión real de
Agustín: `/today`, `/dashboard` y el sidebar expandido — canvas, primary,
focus ring y estado activo del nav confirmados visualmente sin regresiones.

## Bloque UI-2 — App Shell

**Qué cambió:**

- [components/shared/command-palette.tsx](../components/shared/command-palette.tsx)
  (nuevo): búsqueda global / command palette (⌘K), spec puntos 25-27.
  Construido sobre `components/ui/command.tsx`, que ya existía en el
  proyecto (base shadcn) pero no estaba conectado a nada — reutilizado tal
  cual, no reconstruido. Combina:
  - Navegación estática a las 10 secciones de la app.
  - Atajos de creación estáticos (uno por cada ruta `/nuevo` existente).
  - Búsqueda real de clientes y propiedades, vía
    [lib/actions/search.ts](../lib/actions/search.ts) (nuevo Server Action)
    — que a su vez reutiliza `listContacts`/`listProperties` de
    `lib/data/`, las mismas funciones que ya usan `/contacts` y
    `/properties` para su propio filtro `?search=`. Cero lógica de query
    nueva, solo un punto de entrada invocable desde un Client Component.
- [components/shared/quick-create-menu.tsx](../components/shared/quick-create-menu.tsx)
  (nuevo): botón "+ Nuevo" global (spec punto 27) con dropdown a los 6
  formularios de alta existentes. No reemplaza los botones de creación
  contextual que ya tiene cada ficha (ej. "+ Nueva oferta" en propiedad) —
  es solo para crear un registro nuevo desde cualquier pantalla.
- [components/app-header.tsx](../components/app-header.tsx): header ahora
  compone `SidebarTrigger`, `CommandPalette` (ocupa el espacio disponible),
  `QuickCreateMenu` y el avatar/logout — antes solo tenía el trigger y el
  avatar.
- [components/app-sidebar.tsx](../components/app-sidebar.tsx): reagrupa
  secciones siguiendo el punto 21 de la spec — "Clientes"→"Personas",
  "Inventario"→"Negocio" (reordenado: Propiedades, Captaciones, Búsquedas,
  Operaciones), y "Dashboard" pasa a su propia sección "Gestión" en vez de
  quedar suelto. No se agregó un ítem de nav para "Tareas" — no existe esa
  ruta como sección propia hoy (las tareas viven dentro de "Hoy" y de cada
  ficha) y crearla sería un módulo funcional nuevo, fuera de alcance de
  V2.1 (regla 1 de la spec).

**Componentes nuevos:** `CommandPalette`, `QuickCreateMenu`.

**Componentes eliminados:** ninguno.

**Decisiones visuales:**

- La búsqueda global real (no solo navegación) se consideró parte de
  "foundation del shell" y no un módulo funcional nuevo, porque reutiliza
  100% de la lógica de datos existente (`listContacts`/`listProperties` ya
  soportan `search`) — el único código nuevo es el punto de entrada
  Server Action y la UI del picker. No se creó ninguna tabla, columna, ni
  regla de negocio nueva.
- `shouldFilter={false}` en el `<Command>` de cmdk: los resultados mezclan
  ítems estáticos (filtrados acá mismo por substring) con resultados del
  servidor (ya filtrados en `lib/actions/search.ts`) — el filtro difuso
  incorporado de cmdk no puede razonar sobre el grupo asíncrono, así que se
  desactiva y se filtra a mano.
- El botón "+ Nuevo" usa `variant="default"` (primary) — es la primera vez
  en la V2.1 que un botón real usa el color primario como CTA, seteando el
  precedente para los Bloques UI-3 a UI-6 donde se corrige la jerarquía de
  botones pantalla por pantalla.

**Pantallas modificadas:** el shell (`app-header.tsx`, `app-sidebar.tsx`)
afecta a todas las pantallas del dashboard por igual — ninguna página de
negocio individual fue tocada en este Bloque.

**Responsive:** verificado a 375px (mobile) — el campo de búsqueda colapsa a
solo el ícono, el atajo `⌘K` se oculta, "+ Nuevo" colapsa a un botón
ícono-only (`+`), sin overflow horizontal. El command palette (`Dialog`) ya
es responsive de fábrica (Base UI).

**Charts:** sin cambios — Bloque UI-7.

**Deuda pendiente / seguimiento:**

- La búsqueda global hoy cubre clientes y propiedades — no leads,
  búsquedas, captaciones ni operaciones. Ampliar la cobertura si se pide,
  agregado incremental sobre el mismo Server Action.
- Sigue sin existir una sección de nav para "Tareas" — documentado arriba,
  fuera de alcance porque implicaría una ruta/funcionalidad nueva.
- La jerarquía de botones por pantalla (variant="outline" donde debería ir
  "default") sigue pendiente para los Bloques UI-3 a UI-6.

**Verificación:** `npx next typegen`, `npm run typecheck`, `npm run lint`
(se encontró y corrigió un error real de `react-hooks/set-state-in-effect`
en `command-palette.tsx` — ver más abajo), `npm run build` y `npm run
format` corridos sin errores. Verificado en vivo contra `localhost:3000`
con sesión real de Agustín: header con búsqueda/+Nuevo/avatar, apertura de
`⌘K` y por click, filtrado en vivo de navegación/creación al tipear,
dropdown de "+ Nuevo" con las 6 opciones, sidebar reagrupado, y el shell
completo a 375px sin overflow.

**Bug real encontrado y corregido en este Bloque:** `command-palette.tsx`
inicialmente llamaba `setResults(...)` de forma síncrona dentro del cuerpo
de un `useEffect` para limpiar resultados cuando la búsqueda bajaba de 2
caracteres — el lint de React Compiler (`react-hooks/set-state-in-effect`)
lo marcó como error real (cascading renders). Corregido quitando ese
`setState` y gateando el render de resultados por `term.length >= 2` en vez
de por el estado limpio, siguiendo el mismo criterio que
`docs/ARCHITECTURE.md` ya documenta para `react-hooks/purity` en fases
anteriores: dejar que el lint del compilador de React guíe la corrección en
vez de silenciarlo.

## Bloque UI-3 — Hoy

**Qué cambió** (todo en
[app/(dashboard)/today/page.tsx](<../app/(dashboard)/today/page.tsx>) salvo
donde se indica):

- "Requieren tu atención" pasa de `Badge variant="secondary"` (gris plano)
  a `StatusBadge`: el ítem de seguimientos vencidos usa tono `danger`
  ("vencido" — ya pasó su fecha) y las alertas de leads/pipelines sin
  próxima acción usan `warning` ("requiere seguimiento") — primera
  conexión real de `StatusBadge`/`lib/status-tone.ts` (creados en Bloque
  UI-1) a una pantalla.
- `TaskRow` (usada por "Tareas para hoy" y "Seguimientos vencidos"): la
  prioridad pasa de texto plano (`· Alta`) a un `StatusBadge` con
  `taskPriorityTone` — urgente en rojo, alta en naranja, distinguible de un
  vistazo en vez de tener que leer la palabra.
- `AgendaList`: rediseñada como timeline compacto (spec punto 34) — la hora
  pasa a su propia columna en negrita (`lib/format.ts`: nuevo helper
  `formatTime`, mismo patrón seguro de zona horaria que `formatDateTime`,
  solo que sin repetir la fecha en cada fila ya que la lista completa es de
  "hoy").
- `DealsList`: el estado de la operación pasa de texto plano a
  `StatusBadge` con `dealStatusTone`.
- Los 5 cards de la grilla (Agenda, Tareas, Seguimientos vencidos, Leads,
  Operaciones) pasan a `size="sm"` (más densos) y sus `CardTitle` pierden el
  `className="text-muted-foreground text-sm font-medium"` que cada uno
  repetía por separado — ahora heredan el default unificado del componente
  (Bloque UI-1), resolviendo la inconsistencia #3 de la auditoría en esta
  pantalla.

**Componentes nuevos:** ninguno — solo consumo de `StatusBadge` (UI-1).

**Componentes eliminados:** ninguno. `Badge` (el genérico) ya no se importa
en este archivo — todo pasó a `StatusBadge`.

**Decisiones visuales:**

- No se reordenó la grilla ni se convirtió "Completar"/"Reprogramar" en
  acciones solo-hover: la spec dice "preferentemente" al hover, y
  ocultarlas por defecto perjudicaría mobile (sin hover real) sin una
  ganancia de claridad que lo justifique — quedan visibles pero ya eran
  `variant="ghost"` (terciarias), que es la jerarquía correcta.
- `LeadsList` no se tocó: `TodayLead` no tiene un campo `status` real (la
  query ya filtra por `status = 'new'`), así que un `StatusBadge` ahí
  siempre diría "Nuevo" — no aporta información nueva.

**Pantallas modificadas:** `/today` únicamente.

**Responsive:** sin verificación adicional a 375px en este Bloque más allá
de lo ya cubierto por UI-2 (el shell) — la grilla de `/today` ya era
`md:grid-cols-2 xl:grid-cols-3` (colapsa a una columna en mobile) desde V2,
sin cambios de esa lógica en UI-3.

**Charts:** no aplica a esta pantalla.

**Deuda pendiente / seguimiento:** ninguna nueva.

**Verificación:** `npx next typegen`, `npm run typecheck`, `npm run lint`,
`npm run build` y `npm run format` sin errores. Se sembraron datos de
prueba reales (contacto, tarea vencida, tarea de hoy, actividad agendada,
lead sin responder) en la organización de Agustín para verificar en vivo
contra `localhost:3000`: colores de `StatusBadge` correctos (vencido en
rojo, alta/warning en naranja, urgente en rojo), timeline de agenda con
hora en negrita, y el flujo "Completar" probado de punta a punta (la tarea
desaparece de la lista y el estado vacío "Sin tareas para hoy." se muestra
correctamente). Los datos de prueba se borraron después de la verificación
(5/5 registros confirmados eliminados).
