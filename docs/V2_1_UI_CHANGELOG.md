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

## Bloque UI-4 — Entidades

**Qué cambió:**

- [app/(dashboard)/contacts/[id]/page.tsx](<../app/(dashboard)/contacts/[id]/page.tsx>)
  reordenada según la jerarquía de la spec (puntos 36-40): IDENTIDAD
  (header + roles + acciones rápidas Llamar/WhatsApp/Email/+Agendar/+Tarea
  como botones, no links sueltos) → NECESIDAD (Búsquedas, con
  `StatusBadge`/`searchStatusTone`) → ÚLTIMO CONTACTO/PRÓXIMA ACCIÓN (esta
  última con acento de borde primary) → ACTIVIDAD COMERCIAL (Visitas,
  Propiedades presentadas, Registrar actividad, Tareas — prioridad ahora en
  `StatusBadge` —, Notas, Timeline) → **DATOS PERSONALES** (nuevo: DNI,
  dirección, profesión, fecha de nacimiento — `getContact` ya traía estos
  campos con `select("*")`, pero la ficha nunca los mostraba; hueco real de
  contenido encontrado durante este Bloque, no solo un problema de orden).
  Grupos separados por una etiqueta chica/muted (mismo lenguaje visual que
  los headers de sección del sidebar de UI-2), no por un componente nuevo.
- [app/(dashboard)/properties/[id]/page.tsx](<../app/(dashboard)/properties/[id]/page.tsx>)
  reordenada según los puntos 41-45: header con precio grande y estado en
  `StatusBadge` (antes enterrado en un párrafo muted junto a la dirección),
  botón "Agendar visita" pasa a primary. Tab Resumen reordenado:
  Propietarios → Rendimiento (ahora cuenta Interesados/Ofertas en vez de
  repetir precio, que ya está en el header) → **Próxima acción** (nuevo,
  mismo patrón que en ficha cliente — no existía ningún lugar en la ficha
  de propiedad que mostrara la próxima tarea pendiente) → Coincidencias →
  Historial de precios → **Información técnica** (nuevo: dormitorios,
  baños, cocheras, precio/m², superficies, antigüedad, expensas — ninguno
  de estos campos se mostraba en ningún lado de la ficha pese a que
  `getProperty` ya los trae con `select("*")`; el punto 41 de la spec
  pide explícitamente esta sección, y no existía). Badges de estado en
  Interesados y prioridad en Tareas (tab Actividad) pasan a `StatusBadge`.
  Botones de submit ("Registrar oferta", "Registrar", "Agregar", "Guardar
  nota", "Agregar propietario") pasan de `outline` a `default` (primary) —
  cada uno es la única acción de guardado dentro de su propio formulario.
- Listados (`/properties`, `/leads`, `/searches`): el badge de estado pasa
  de `Badge variant="secondary"` a `StatusBadge` con el tono correspondiente
  — mismo patrón ya aplicado en `/today` (Bloque UI-3). `/contacts` no se
  tocó: sus badges son de _rol_ (Comprador/Vendedor), no de estado, y no
  tienen semántica de tono.

**Componentes nuevos:** ninguno — solo consumo de `StatusBadge`/
`lib/status-tone.ts` (UI-1) en más pantallas.

**Componentes eliminados:** ninguno. `Badge` genérico ya no se importa en
`leads/page.tsx`, `searches/page.tsx` ni `properties/page.tsx` (reemplazado
100% por `StatusBadge` en esos archivos); sigue en uso donde corresponde
(roles de contacto, tipo/operación de propiedad — no son "estado").

**Decisiones visuales:**

- Los grupos ("NECESIDAD", "ACTIVIDAD COMERCIAL", "DATOS PERSONALES") son
  un `<p>` con una clase compartida (`GROUP_LABEL_CLASS`), no un componente
  nuevo — una sola línea de className no ameritaba envoltorio (punto 91,
  evitar sobreabstracción).
- No se creó un componente `EntityHeader` genérico pese a que la spec lo
  sugiere como candidato (`docs/DESIGN_SYSTEM.md`): los headers de cliente
  y propiedad comparten el patrón visual pero no la data ni las acciones —
  abstraerlos ahora habría sido la sobreabstracción que el punto 91 pide
  evitar. Se reevalúa si aparece un tercer header con la misma forma.
- "Datos personales" e "Información técnica" solo se renderizan si hay al
  menos un campo cargado (`.filter(...).length > 0`) — no se agregan
  secciones vacías a fichas de registros viejos que nunca cargaron esos
  campos.

**Pantallas modificadas:** `/contacts/[id]`, `/properties/[id]`,
`/properties`, `/leads`, `/searches`.

**Responsive:** sin verificación dedicada a 375px en este Bloque — las
fichas ya usaban `max-w-3xl` + `flex-wrap` desde V2 (incluida la corrección
de `flex-1`/`min-w-*` del Bloque H), y los cambios de este Bloque son
reordenamiento y color, no layout nuevo. Verificación mobile dedicada de
fichas queda para Bloque UI-8.

**Charts:** no aplica.

**Deuda pendiente / seguimiento:** ninguna nueva — los dos huecos de
contenido reales encontrados (datos personales de cliente, información
técnica de propiedad) se corrigieron en este mismo Bloque, no se
documentaron como deuda.

**Verificación:** `npx next typegen`, `npm run typecheck`, `npm run lint`,
`npm run build` y `npm run format` sin errores. Se sembró un cliente con
todos los campos personales, una búsqueda, una propiedad con todos los
campos técnicos, un vínculo de propietario y tareas en ambas fichas —
verificado en vivo contra `localhost:3000`: orden de secciones correcto en
ambas fichas (confirmado vía `get_page_text`, texto completo revisado
línea por línea), coincidencia del 100% mostrada correctamente en
"Coincidencias" (la búsqueda y la propiedad sembradas calzan a propósito),
`StatusBadge` con tono correcto en "Buscando" (primary), "Activa"
(primary), y en los listados de `/properties`. Sin errores de consola más
allá del artefacto ya documentado de HMR del dev server. Los 7 registros de
prueba se borraron y se confirmó vacío después.

## Bloque UI-5 — Pipelines

**Qué cambió:**

- [components/acquisitions/acquisitions-board.tsx](../components/acquisitions/acquisitions-board.tsx)
  y [components/deals/deals-board.tsx](../components/deals/deals-board.tsx)
  (nuevos, un componente cliente por entidad): toolbar de filtro (spec punto 50) — búsqueda por propiedad/propietario (o comprador/vendedor) siempre
  visible, select de estado solo en vista tabla (en Kanban el estado ya está
  representado por la columna), "Limpiar filtros". Filtra en memoria, sin
  round-trip al servidor — `listAcquisitions`/`listDeals` ya cargan todas
  las filas de la organización sin paginar, y `acquisition_overview`/
  `deal_overview` no traen el título de la propiedad ni el nombre del
  propietario aplanados (confirmado leyendo el SQL de la vista), así que un
  filtro `ilike` server-side habría exigido tocar el schema — innecesario
  cuando el array ya está completo en memoria. `page.tsx` de ambas rutas se
  simplifica: ya no arma la tabla inline, sólo pasa los datos al nuevo board.
- Tarjetas de Kanban (`components/acquisitions/kanban-board.tsx`,
  `components/deals/kanban-board.tsx`): sacan `shadow-sm` (regla "borde >
  sombra" de Bloque UI-1/spec punto 20); las líneas de "último contacto" y
  "próxima acción" se combinan en una sola línea compacta; en captaciones,
  la cuenta de pendientes pasa de texto plano a un `StatusBadge` (`warning`).
- `StatusBadge` conectado también en `/acquisitions/[id]` y `/deals/[id]`
  (estado del header, prioridad de tareas) — mismo patrón que Bloques UI-3
  y UI-4, no estaban cubiertos todavía.
- Botón "Agendar visita" ya venía primary desde UI-4; en este Bloque los
  botones "Captación"/"Operación" (crear) del header de lista ya eran
  primary desde antes — sin cambios ahí, se verificó que ya cumplían la
  jerarquía.

**Componentes nuevos:** `AcquisitionsBoard`, `DealsBoard`.

**Componentes eliminados:** ninguno — la tabla inline que vivía en
`acquisitions/page.tsx`/`deals/page.tsx` se movió a los boards nuevos, no
se eliminó funcionalidad.

**Bug real encontrado y corregido en este Bloque:** al agregar el filtro,
el Kanban dejó de reaccionar a los cambios de búsqueda/estado — la tabla sí
se actualizaba, el Kanban no. Causa: `KanbanBoard` guarda su propia copia
local del array (`useState(acquisitions)`) para soportar el
drag-and-drop optimista, y `useState` solo lee su valor inicial en el
primer render — antes de este Bloque nunca importaba, porque
`acquisitions`/`deals` eran una prop estática de un Server Component que
jamás cambiaba después del mount. Al volverse una prop reactiva (filtrada
por un componente cliente padre), esa copia local quedó pegada a los datos
del primer render para siempre. Primer intento de fix
(`useEffect(() => setItems(acquisitions), [acquisitions])`) funcionaba pero
disparó `react-hooks/set-state-in-effect` (mismo lint del Bloque UI-2) —
corregido con el patrón que React documenta para "ajustar estado cuando
cambia una prop": comparar contra un valor previo guardado en estado y
llamar `setState` condicionalmente _durante el render_, no en un efecto
(ver el comentario en ambos `kanban-board.tsx`). Verificado explícitamente
que el fix no rompe el drag-and-drop: se arrastró una tarjeta entre
columnas después del fix y el cambio de fase se guardó correctamente.

**Decisiones visuales:**

- El filtro de estado no aparece en la vista Kanban — ahí la columna ya
  cumple esa función; mostrarlo igual sería redundante y podría confundir
  (filtrar por una fase mientras se ven todas las columnas).
- No se creó un componente `FilterBar` genérico compartido entre
  captaciones y operaciones pese a la similitud — los campos de búsqueda
  son distintos (propietario vs. comprador/vendedor) y cada board ya es
  pequeño; una abstracción compartida en este punto sería la
  sobreabstracción que pide evitar el punto 91.
- No se tocaron las páginas `/acquisitions/[id]` ni `/deals/[id]` más allá
  de conectar `StatusBadge` — la reestructuración de jerarquía tipo Bloque
  UI-4 no está en el alcance nombrado de este Bloque (la spec no las lista
  como "ficha" en ningún punto 36-45); queda anotado como posible Bloque
  futuro si se pide.

**Pantallas modificadas:** `/acquisitions`, `/deals`, `/acquisitions/[id]`,
`/deals/[id]`.

**Responsive:** sin verificación dedicada a 375px — el Kanban ya usaba
`overflow-x-auto` desde V2 (scroll horizontal de columnas en mobile, no
compresión), sin cambios a esa mecánica en este Bloque.

**Charts:** no aplica.

**Deuda pendiente / seguimiento:**

- Fichas de captación/operación (`/acquisitions/[id]`, `/deals/[id]`)
  siguen siendo una pila plana de cards, igual que ficha cliente/propiedad
  antes de Bloque UI-4 — no se tocó su jerarquía en este Bloque por estar
  fuera del alcance nombrado. Candidato para un Bloque futuro si se pide.
- La búsqueda del filtro de captaciones/operaciones no cubre origen ni
  fase por texto (solo propiedad/propietario/comprador/vendedor) — ampliar
  si hace falta.

**Verificación:** `npx next typegen`, `npm run typecheck`, `npm run lint`
(encontró el bug de `set-state-in-effect` documentado arriba, corregido),
`npm run build` y `npm run format` sin errores. Se sembraron dos
captaciones en fases distintas ("Nuevo" y "Captada") con propiedades y
nombres a propósito distinguibles por texto, verificado en vivo contra
`localhost:3000`: filtro de búsqueda funcionando en Kanban y en tabla
(confirmado el bug original — el Kanban no se actualizaba — y confirmado el
fix), el filtro persiste al cambiar entre vista Kanban/tabla, "Limpiar
filtros" funciona, `StatusBadge` con tono correcto ("Captada" en verde/
success), y drag-and-drop entre columnas probado de punta a punta después
del fix sin regresión. Los 3 registros de prueba (2 propiedades + 1
contacto, cascadeando a las captaciones) se borraron y se confirmó vacío
después.

## Bloque UI-6 — Agenda / Tasks

**Qué cambió:**

- [components/activities/visit-feedback-dialog.tsx](../components/activities/visit-feedback-dialog.tsx):
  "Finalizar visita" pasa de `Dialog` (modal centrado) a `Sheet` (drawer
  lateral) — spec punto 56, que nombra "Finalizar visita" explícitamente
  como uno de los casos ideales para drawer. Es además el primer uso real
  de `components/ui/sheet.tsx` en toda la app (existía desde la base
  shadcn, sin conectar — mismo hallazgo que `command.tsx` en Bloque UI-2).
  Mismo formulario, misma lógica (`finalizeVisit`), solo cambia el
  contenedor — el usuario no pierde el contexto del calendario detrás.
- [app/(dashboard)/calendar/page.tsx](<../app/(dashboard)/calendar/page.tsx>):
  el badge de estado de un evento (`Realizado`/`Cancelado`) pasa de
  `Badge variant="secondary"` a `StatusBadge` con `activityStatusTone`.
- [components/calendar/month-grid.tsx](../components/calendar/month-grid.tsx):
  el círculo de "hoy" pasa de `bg-foreground` (gris/negro) a
  `bg-primary` — mismo criterio que el resto de la V2.1, `primary` para
  "selección/interacción activa" (spec punto 12).
- [components/activities/visit-feedback-list.tsx](../components/activities/visit-feedback-list.tsx):
  nivel de interés y "quiere avanzar" pasan de texto plano concatenado a
  `StatusBadge` (nuevos helpers `visitInterestLevelTone`/
  `visitWantsToProceedTone` en `lib/status-tone.ts`); los emoji 👍/👎 pasan
  a íconos Lucide (`ThumbsUp`/`ThumbsDown`) — spec punto 24, un único set
  de iconografía, sin emoji como iconografía de producto.

**Componentes nuevos:** ninguno — `Sheet` ya existía (Bloque UI-6 le da su
primer uso real), `visitInterestLevelTone`/`visitWantsToProceedTone` son
funciones nuevas en `lib/status-tone.ts`, no componentes.

**Componentes eliminados:** ninguno.

**Decisiones visuales:**

- No se convirtieron los formularios inline de "Nueva tarea"/"Nueva nota"
  (en las fichas de cliente/propiedad/captación/operación) a drawers, pese
  a que la spec los nombra como candidatos (punto 56). Son formularios
  cortos (2-3 campos) ya compactos dentro de su Card — convertirlos habría
  significado tocar 5-6 archivos ya verificados en Bloques anteriores para
  una ganancia marginal, mientras que "Finalizar visita" (7 campos, forma
  la más grande de un quick-action existente) es el caso donde un drawer
  aporta más que un modal centrado. Queda anotado como posible pulido
  futuro si se pide explícitamente.
- El badge de "Hoy" en la vista semana del calendario (`Badge
variant="secondary"`) no se tocó — no es un estado de negocio con
  semántica success/warning/danger, es un marcador de "día actual"; forzarlo
  a `StatusBadge` no aportaría claridad.

**Pantallas modificadas:** `/calendar` (las tres vistas), ficha
cliente/propiedad en su tab "Visitas" (consumen `VisitFeedbackList`, sin
cambios propios).

**Responsive:** sin verificación dedicada a 375px — el drawer usa
`SheetContent` con `w-3/4` en mobile (ya definido por el componente base,
sin tocar), y el resto de los cambios son de color/ícono, no de layout.

**Charts:** no aplica.

**Deuda pendiente / seguimiento:**

- "Nueva tarea"/"Nueva nota" inline quedan como están (ver decisión
  arriba) — candidato a drawer si se pide explícitamente más adelante.

**Verificación:** `npx next typegen`, `npm run typecheck`, `npm run lint`,
`npm run build` y `npm run format` sin errores. Se sembró una visita
agendada (para probar "Finalizar visita" de punta a punta) y un evento
cancelado (para el `StatusBadge` de estado), verificado en vivo contra
`localhost:3000`: el drawer se abre deslizando desde la derecha con
transición correcta, el formulario completo es usable, "Guardar y
finalizar" cambia el estado del evento a "Realizado" (confirmado por
`get_page_text`), y el feedback cargado aparece con los `StatusBadge`
correctos ("Muy interesado" y "Avanza: Sí" en verde/success) en la ficha de
la propiedad. Sin errores de consola. Los 4 registros de prueba (contacto,
propiedad, 2 actividades) se borraron y se confirmó vacío después.

## Bloque UI-7 — Dashboard

**Qué cambió:**

- [lib/date.ts](../lib/date.ts) (nuevo): `getPreviousPeriodYmdRange` —
  calcula el rango "período anterior comparable" para cada
  `DashboardPeriod` (spec punto 67: "Visitas 24 +12% vs período anterior").
  `this_month`/`last_month`/`quarter` reutilizan los mismos helpers
  `firstOfMonth`/`addMonths` ya usados por `getPeriodYmdRange` (se subieron
  a scope de módulo para compartirlos); `year` compara el mismo rango
  "1 de enero → hoy" pero un año atrás, ya que "year" acá es year-to-date
  rolling, no un año calendario fijo (ver el comentario ya existente en
  `getPeriodYmdRange`) — comparar contra un año calendario completo sería
  comparar cosas distintas. `all` devuelve `null` (no hay "período
  anterior" de un total histórico).
- [lib/data/dashboard.ts](../lib/data/dashboard.ts): los 5 KPIs con fecha
  propia (`getLeadsKpi`, `getVisitsKpi`, `getValuationsKpi`,
  `getReservationsKpi`, `getClosingsKpi`) aceptan ahora un
  `DashboardPeriod` **o** un rango ya resuelto (`resolvePeriodRange`,
  nuevo helper interno) — así la misma función se llama dos veces (período
  actual + `getPreviousPeriodYmdRange`) sin duplicar ninguna lógica de
  query. Los 3 embudos no se tocaron: son fotos de cohorte por etapa
  actual, no tienen un "período anterior" comparable de la misma forma.
- [components/dashboard/kpi-card.tsx](../components/dashboard/kpi-card.tsx)
  (nuevo — ya estaba listado como candidato en `docs/DESIGN_SYSTEM.md`):
  card compacta con el valor y, cuando hay una base comparable, una
  flecha + porcentaje en `success`/`danger`/muted según el signo (spec
  punto 74: "positivo → success, negativo → danger"). `delta: null`
  (período anterior fue 0 pero el actual no) no muestra nada — mostrar
  "+∞%" sería engañoso, no informativo.
- [app/(dashboard)/dashboard/page.tsx](<../app/(dashboard)/dashboard/page.tsx>):
  las 8 KPI cards pasan a `KpiCard` con su delta (excepto "Propiedades
  captadas", que sale del embudo de captaciones — sin período anterior
  comparable, ver arriba). El pill de período activo pasa de
  `bg-foreground` a `bg-primary`.
- [components/dashboard/funnel-bars.tsx](../components/dashboard/funnel-bars.tsx):
  la barra de relleno pasa de `bg-foreground` a `bg-primary` (spec punto
  74: "serie principal → primary"); cada etapa ahora muestra también su
  porcentaje de conversión relativo a la primera etapa del embudo (spec
  punto 72: "Mostrar: cantidad; porcentaje de conversión" — antes solo
  mostraba la cantidad cruda). `title` con el detalle completo a modo de
  tooltip nativo, sin agregar una librería de charts para esto.

**Componentes nuevos:** `KpiCard`.

**Componentes eliminados:** ninguno.

**Decisiones visuales:**

- El delta solo se calcula para los 5 KPIs con fecha propia — no para
  "Propiedades captadas" (derivado del embudo, una foto de cohorte, no una
  query con fecha) ni para los embudos mismos. Extender el patrón a los
  embudos habría significado decidir qué significa "período anterior" para
  una distribución de etapas, una pregunta distinta a la de un KPI
  numérico simple — fuera de alcance de este Bloque.
- Sin librería de gráficos: se mantiene el criterio ya documentado en
  `funnel-bars.tsx` (barras CSS a mano, volumen de datos de un asesor
  individual no lo justifica) — Bloque UI-7 refina lo que ya existe en vez
  de introducir `recharts`/similar, consistente con la regla 96 de no
  instalar dependencias nuevas sin necesidad real.

**Pantallas modificadas:** `/dashboard` únicamente.

**Responsive:** sin verificación dedicada a 375px — la grilla de KPIs ya
era `md:grid-cols-2 xl:grid-cols-4` desde Fase 10, sin cambios de esa
lógica en este Bloque.

**Charts:** ver "Qué cambió" arriba — color primary en barras de embudo,
porcentaje de conversión agregado, sin gráficos nuevos (line/bar) en este
Bloque; los embudos ya cubrían el punto 72 razonablemente bien una vez
coloreados y con el porcentaje.

**Deuda pendiente / seguimiento:**

- No hay gráfico de tendencia temporal (leads/visitas/captaciones por mes)
  ni de origen de leads (spec puntos 70-71) — el dashboard actual es todo
  KPIs + embudos, sin series temporales. Agregar esto requeriría datos
  agrupados por mes (nueva query, no solo un total del período) y
  probablemente sí justificaría una librería de charts liviana — capaz
  bloque futuro si se pide explícitamente.

**Verificación:** `npx next typegen`, `npm run typecheck`, `npm run lint`,
`npm run build` y `npm run format` sin errores. Se sembraron leads en dos
meses distintos (2 en agosto, 4 en septiembre) para verificar el delta en
vivo contra `localhost:3000`: "Leads nuevos" en "Este mes" mostró
correctamente "4 +100%" en verde con flecha ascendente; en "Mes pasado"
mostró "2" sin badge de delta (caso sin base comparable — 0 leads el mes
anterior a agosto — confirmado que no se muestra "+∞%" ni ningún número
engañoso). Se sembraron 3 captaciones en distintas etapas para verificar
el embudo: "Nuevo" mostró "100% · 2" y "Captada" "50% · 1", barras en azul
primary. Sin errores de consola más allá del artefacto de HMR ya
documentado. Los 13 registros de prueba (6 leads, 3 propiedades, 1
contacto, 3 captaciones) se borraron y se confirmó vacío después.

## Bloque UI-8 — Mobile

Auditoría real a 375px (spec punto 84) contra `localhost:3000` con datos
sembrados a propósito (nombres largos, direcciones largas, título de
propiedad largo) sobre las pantallas nombradas en el punto 78: Hoy, ficha
cliente, ficha propiedad, Agenda (día/mes), Captaciones (Kanban/tabla) y
las 6 listas (`/properties`, `/contacts`, `/leads`, `/searches`,
`/acquisitions`, `/deals`). Verificación de overflow horizontal real vía
`document.documentElement.scrollWidth` vs. `clientWidth` en cada pantalla,
no solo inspección visual.

**Bugs reales encontrados y corregidos (3):**

1. **Ícono de editar flotando en medio de un título largo envuelto.**
   `contacts/[id]`, `properties/[id]`, `leads/[id]`, `searches/[id]`: el
   `<h1>` del título y el botón de lápiz vivían en un
   `flex items-center gap-2` — con un título corto esto centra el ícono
   bien, pero con un título de 3-4 líneas (nombres largos, títulos de
   propiedad largos) el ícono queda centrado respecto a _todo el bloque
   envuelto_, flotando en el medio, visualmente desconectado de cualquier
   línea. Corregido a `items-start` en los 4 archivos — el ícono queda
   alineado arriba, junto a la primera línea, sea cual sea la altura del
   título.
2. **Botón "Agendar visita" comprimiendo el título de la propiedad.**
   El contenedor externo del header de `properties/[id]`
   (`flex items-start justify-between gap-4`, sin `flex-wrap`) forzaba al
   bloque del título a compartir la fila con el botón incluso en mobile,
   angostando el título a la mitad del ancho disponible y agravando el bug
   #1. Corregido con `flex-wrap` — el botón cae a su propia línea debajo
   del título en pantallas angostas.
3. **Acciones de un evento de agenda apretando el contenido a una columna
   angosta.** `EventRow` en `/calendar` ponía hora + contenido + botones de
   acción en una sola fila sin wrap; los botones (`shrink-0`) nunca cedían
   espacio, así que el contenido (con nombre de cliente + ubicación) se
   comprimía a ~140px de ancho y se envolvía en 5-6 líneas muy angostas.
   Reestructurado a `flex-col` (hora+contenido arriba, acciones debajo) en
   mobile y `sm:flex-row` (todo en una fila, como antes) desde el
   breakpoint `sm` en adelante — mismo patrón responsive ya usado en otras
   partes de la V2.1.
4. **Overflow horizontal real de página en 6 listados.** El header de
   `/acquisitions`, `/deals`, `/properties`, `/contacts`, `/leads` y
   `/searches` (`flex items-center justify-between`, sin `flex-wrap`)
   desbordaba la página en mobile cuando había 2-3 botones junto al título
   — confirmado con `scrollWidth` 463px en un viewport de 375px en
   `/acquisitions` (3 botones: "Ver tabla", "+ Captación rápida",
   "+ Captación"). Corregido agregando `flex-wrap gap-3` a los 6 headers —
   mismo patrón que ya usaban `/calendar` y `/dashboard` desde sus propios
   Bloques (UI-2 y UI-7 respectivamente), que por eso no tenían este bug.

**Revisado y confirmado sin cambios necesarios:**

- Grilla de mes del calendario (`month-grid.tsx`): usa
  `min-w-[840px]` dentro de un contenedor `overflow-x-auto` — en mobile
  esto produce scroll horizontal _contenido_ (confirmado que no desborda
  la página), un patrón deliberado y común para calendarios de mes. No se
  reconstruyó como lista/tarjetas porque el mismo `/calendar` ya ofrece
  vistas "Semana"/"Día" mucho más aptas para mobile a un toque de
  distancia — construir una tercera representación solo para mes en mobile
  sería la reconstrucción que la regla 1 de la spec pide evitar.
- Kanban de captaciones/operaciones: mismo criterio, columnas de
  `w-64 shrink-0` con scroll horizontal contenido — ya revisado y aceptado
  en Bloque UI-5, sin cambios nuevos necesarios acá.
- Fichas de cliente/propiedad (el resto de sus secciones —
  Necesidad/Actividad comercial/Datos personales, Información técnica,
  etc.) y `/today`: sin overflow ni problemas de wrap encontrados con los
  datos de prueba (deliberadamente largos) sembrados para este Bloque.

**Componentes nuevos:** ninguno.

**Componentes eliminados:** ninguno.

**Pantallas modificadas:** `contacts/[id]`, `properties/[id]`,
`leads/[id]`, `searches/[id]`, `/calendar`, `/acquisitions`, `/deals`,
`/properties`, `/contacts`, `/leads`, `/searches` (10 archivos).

**Responsive:** este Bloque _es_ la verificación responsive — ver arriba.

**Charts:** no aplica.

**Deuda pendiente / seguimiento:** ninguna nueva — los 3 bugs reales
encontrados se corrigieron en este mismo Bloque.

**Verificación:** `npm run typecheck`, `npm run lint`, `npm run build` y
`npm run format` sin errores. Auditoría en vivo a 375px contra
`localhost:3000` con datos sembrados a propósito extensos (nombre de
cliente de 2 palabras + apellido compuesto, dirección larga, título de
propiedad de 9 palabras) sobre las 11+ pantallas nombradas arriba, cada una
confirmada sin overflow horizontal de página vía
`scrollWidth === clientWidth` (no solo revisión visual) antes y después de
cada fix. Los 13 registros de prueba se borraron y se confirmó vacío
después.

## Bloque UI-9 — Polish final

**Qué cambió:**

- **Barrido de consistencia de botones** (spec punto 95: "'Guardar' primary
  en una pantalla y secondary en otra"): 18 botones de guardar/crear que
  seguían en `variant="outline"` pasan a `variant="default"` en
  `searches/[id]` (5), `leads/[id]` (4), `deals/[id]` (4),
  `acquisitions/[id]` (4) y `properties/[id]` (1) — el mismo fix que los
  Bloques UI-4/UI-5 ya habían aplicado en `contacts/[id]` y
  `properties/[id]`, pero que no había llegado a estas otras 4 fichas. Se
  dejaron deliberadamente en `outline` las acciones que no son creación
  (`Filtrar`, `Desconectar` en `/settings`, `Marcar perdida` en
  captaciones — esta última casi destructiva, no una acción positiva).
- **Barrido de `StatusBadge`**: `leads/[id]` y `searches/[id]` todavía
  usaban `<Badge>` plano para el estado del lead/búsqueda en el header —
  quedaron afuera de los Bloques UI-4/UI-5 porque esos Bloques se
  centraron en otras pantallas. Convertidos a `StatusBadge` con
  `leadStatusTone`/`searchStatusTone`. Grep final
  (`<Badge[^>]*>{[A-Z_]*STATUS`) sobre toda la app: cero resultados — todo
  badge de estado de negocio pasa por `StatusBadge`.
- [components/shared/empty-state.tsx](../components/shared/empty-state.tsx)
  (nuevo — ya listado como candidato en `docs/DESIGN_SYSTEM.md`): title +
  description + un CTA (spec punto 60), consolidando la misma estructura
  que `/properties`, `/contacts`, `/leads`, `/searches`, `/acquisitions` y
  `/deals` ya duplicaban por separado para su estado "lista totalmente
  vacía" (con `+ Nuevo X` como acción, ya presente en las 6).
- `loading.tsx` (nuevos, 9 rutas: `/today`, `/dashboard`, `/calendar`,
  `/properties`, `/contacts`, `/leads`, `/searches`, `/acquisitions`,
  `/deals`) +
  [components/shared/page-skeleton.tsx](../components/shared/page-skeleton.tsx)
  (nuevo): spec punto 61 — "preferir skeletons... no spinner gigante
  central". Convención nativa de Next.js App Router: un `loading.tsx` en
  el segmento envuelve automáticamente ese `page.tsx` en un `<Suspense>`
  con ese fallback — cero cambios a los Server Components existentes,
  cero riesgo de romper la lógica de datos que ya funcionaba.
- [app/(dashboard)/error.tsx](<../app/(dashboard)/error.tsx>) (nuevo):
  spec punto 62 — "No pudimos cargar las visitas. [Reintentar]", como red
  de seguridad para un error realmente inesperado (no para una query de
  Supabase fallida — esas ya loguean y devuelven `[]`/`null` en vez de
  tirar, ver `docs/ARCHITECTURE.md`, así que casi nunca van a disparar
  este boundary; la mayoría de los "no pudimos cargar X" de esta app ya
  se resuelven como una lista vacía, no como un error).
- [docs/V2_1_FOLLOWUPS.md](../docs/V2_1_FOLLOWUPS.md) (nuevo): consolida
  toda la deuda "Deuda pendiente / seguimiento" dispersa en este changelog
  Bloque por Bloque en un solo lugar (spec punto 92).

**Componentes nuevos:** `EmptyState`, `PageSkeleton`.

**Componentes eliminados:** ninguno — el markup duplicado de empty state en
los 6 listados se reemplazó por `EmptyState`, sin quitar funcionalidad.

**Decisiones visuales:**

- `loading.tsx` a nivel de ruta, no `<Suspense>` granular dentro de cada
  página envolviendo secciones individuales — más simple, cero riesgo, y
  suficiente para páginas que ya hacen todo su fetch en un solo
  `Promise.all` al principio (todas las tocadas en V2.1). Un
  `<Suspense>` granular (cargar el header antes que las cards) sería una
  optimización real pero de otro orden de esfuerzo — no es lo que pide el
  punto 61 ("preferir skeletons" vs. spinner, no streaming granular).
- `error.tsx` a nivel de todo el segmento `(dashboard)`, no uno por ruta —
  20+ páginas comparten el mismo criterio de "error inesperado, botón
  reintentar", un solo boundary alcanza sin duplicar el mismo componente
  20 veces.

**Pantallas modificadas:** `searches/[id]`, `leads/[id]`, `deals/[id]`,
`acquisitions/[id]`, `properties/[id]` (botones/badges), `/properties`,
`/contacts`, `/leads`, `/searches`, `/acquisitions`, `/deals` (empty
state), + 9 rutas nuevas con `loading.tsx`.

**Responsive:** sin cambios de layout en este Bloque.

**Charts:** no aplica.

**Deuda pendiente / seguimiento:** ver `docs/V2_1_FOLLOWUPS.md` (nuevo,
consolida todo lo de Bloques anteriores).

**Checklist de QA final (spec punto 94), verificado sobre la V2.1
completa:**

- ✅ Spacing/alignment: escala 4/8/12/16/24/32 sin arbitrarios (auditado en
  UI-1, sin cambios desde entonces).
- ✅ Font sizes: `CardTitle` unificado a `text-sm font-semibold` (UI-1),
  page title `text-2xl` consistente en las 11 pantallas principales.
- ✅ Colors: un solo primary (`#2563EB`), tokens semánticos vía
  `lib/status-tone.ts` — cero color hardcodeado (`bg-green-500` etc.)
  encontrado en el grep final de este Bloque.
- ✅ Badges: `StatusBadge` en el 100% de los estados de negocio (grep
  final, cero `<Badge>` plano con un `*_STATUS_LABELS`).
- ✅ Button hierarchy: primary para creación/guardado, outline para
  acciones secundarias/filtros, ghost para terciarias — barrido completo
  en este Bloque, sin inconsistencias restantes encontradas.
- ✅ Tables: un solo `Table` component, densidad consistente (sin cambios
  desde antes de V2.1, ya estaba bien).
- ✅ Forms: alturas de `Input`/`Select` consistentes (`h-8`), sin cambios
  necesarios.
- ✅ Empty states: consolidados en `EmptyState`, con CTA en los 6 listados
  principales.
- ✅ Loading: `loading.tsx` en las 9 rutas de mayor tráfico.
- ✅ Responsive/mobile: auditoría dedicada completa en Bloque UI-8, 3 bugs
  reales encontrados y corregidos, verificado sin overflow horizontal de
  página en 11+ pantallas.
- ✅ Charts: colores primary/success/danger en vez de paleta arbitraria
  (Bloque UI-7); sin gráficos de línea/barra nuevos — ver
  `docs/V2_1_FOLLOWUPS.md`.

**Verificación:** `npx next typegen`, `npm run typecheck`, `npm run lint`,
`npm run build` y `npm run format` sin errores en cada paso de este
Bloque. Verificado en vivo contra `localhost:3000`: `EmptyState` renderiza
correctamente en `/properties` y `/leads` (organización sin datos —
confirmado con la base real, sin necesitar sembrar/borrar nada esta vez),
`loading.tsx` capturado en acción (un `get_page_text` disparado justo
después de navegar devolvió el fallback en vez del contenido final, la
segunda llamada ya mostró el contenido real). Sin errores de consola más
allá del artefacto de HMR ya documentado.

---

Con este Bloque se completan los 9 Bloques de la iteración V2.1
(Foundation → App Shell → Hoy → Entidades → Pipelines → Agenda/Tasks →
Dashboard → Mobile → Polish final). Ver `docs/V2_1_UI_AUDIT.md` para el
diagnóstico inicial, `docs/DESIGN_SYSTEM.md` para la fuente de verdad de
tokens/componentes, y `docs/V2_1_FOLLOWUPS.md` para lo que queda
deliberadamente fuera de alcance.
