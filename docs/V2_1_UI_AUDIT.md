# V2.1 — Auditoría visual

Auditoría del sistema visual actual (V1 + V2, commit `782a414`) antes de
empezar el rediseño V2.1. Basada en inspección de código de todos los
componentes de `components/ui/`, del shell (`app-sidebar.tsx`,
`app-header.tsx`, `app/(dashboard)/layout.tsx`) y de las pantallas principales
(`/today`, `/dashboard`, `/contacts/[id]`, `/properties/[id]`,
`/acquisitions`), complementada con renderizado real vía Claude Browser
(login, shell, estados vacíos) — ver metodología al final.

## 1. Sistema actual

### Colores

- Paleta neutra en OKLCH, sin matiz (`oklch(X 0 0)` — puro escala de grises),
  definida en [app/globals.css](../app/globals.css). No existe un color de
  marca: `--primary` en light mode es `oklch(0.205 0 0)` (gris casi negro),
  igual al `--foreground`. Es el tema neutro por defecto de shadcn, nunca
  personalizado.
- No hay tokens semánticos (`success`/`warning`/`danger`) en absoluto. El
  único color "de estado" disponible es `--destructive` (rojo), usado solo
  para acciones destructivas de UI (botón variant `destructive`), nunca para
  comunicar estado de negocio (vencido, cancelado).
- **No hay arcoíris de estados** — pero por ausencia total de estrategia, no
  por disciplina: todo estado de negocio (`PROPERTY_STATUS_LABELS`,
  `DEAL_STATUS_LABELS`, `SEARCH_STATUS_LABELS`, `ACQUISITION_STATUS_LABELS`,
  etc.) se renderiza con `<Badge variant="secondary">` — gris plano, sin
  distinguir "vencido" de "activo" de "cerrado". Todo pasa por
  `badgeVariants`, pero esas variantes (`default/secondary/destructive/
outline`) no están mapeadas a semántica de negocio en ningún lado — cada
  pantalla llama `<Badge variant="secondary">{STATUS_LABELS[x]}</Badge>` de
  forma independiente (17 archivos distintos con la misma lógica repetida).
  Única excepción encontrada, y confirma la falta de un token `success`:
  [app/(dashboard)/settings/page.tsx:90](<../app/(dashboard)/settings/page.tsx>)
  usa `border-emerald-500/30 bg-emerald-500/10 text-emerald-700
dark:text-emerald-400` a mano para el aviso "Conectado correctamente" de
  Google Calendar, justo al lado de un `border-destructive/30
bg-destructive/10 text-destructive` para el caso de error — el patrón ya
  existe para `destructive`, solo falta el equivalente `success` para no
  tener que hardcodear `emerald-*`.

### Typography

- Una sola familia sans-serif (`--font-sans`, Geist vía `next/font`) — bien,
  no hay que tocarla.
- Jerarquía real observada:
  - Page title: `text-2xl font-semibold tracking-tight` (consistente en
    `/today`, `/dashboard`, `/contacts/[id]`, `/properties/[id]`,
    `/acquisitions`).
  - Card title: `text-sm` o `text-sm font-medium text-muted-foreground`
    (inconsistente — algunas cards usan `CardTitle` con peso por defecto,
    otras fuerzan `text-muted-foreground text-sm font-medium`, ver
    `today/page.tsx` vs `contacts/[id]/page.tsx`).
  - Body: `text-sm` casi en todos lados.
  - Metadata secundaria: `text-muted-foreground` con el mismo `text-sm` que
    el body — no hay un tamaño 13px/12px diferenciado para metadata vs.
    contenido primario.

### Spacing

- Escala Tailwind estándar en uso real: `gap-1`, `gap-1.5`, `gap-2`, `gap-3`,
  `gap-4`, `space-y-2`, `space-y-4`, `space-y-6`, `p-4`, `p-6`. No se
  encontraron valores arbitrarios (`p-[13px]` etc.) — la escala ya es
  coherente, buena base para tokenizar formalmente.
- Padding de página: `p-4 md:p-6` en el layout — razonable, no excesivo.
- `--card-spacing: --spacing(4)` (16px) por defecto, `--spacing(3)` (12px)
  en `size="sm"` — la variante `sm` de `Card` existe pero **no se usa en
  ningún lugar del código actual** (grep: cero `size="sm"` sobre `<Card`).
  Todas las cards actuales usan el padding grande por defecto, incluso las
  que muestran una sola línea de texto (ver `/today`, KPIs del dashboard).

### Radius

- Base `--radius: 0.625rem` (10px), con escala derivada
  (`sm`=0.6x, `md`=0.8x, `lg`=1x, `xl`=1.4x...). Ya es una escala tokenizada
  correctamente vía `@theme inline` — buena base, no hay mezcla arbitraria de
  `rounded-sm`/`rounded-3xl` sueltos por pantalla.
- Badges usan `rounded-4xl` (pill) — consistente en todos los usos.

### Borders / Shadows

- `Card` usa `ring-1 ring-foreground/10` en vez de `border` + `shadow` — es
  decir, ya sigue el principio "borde > sombra" del punto 20 de la spec, sin
  sombras pesadas en ningún componente auditado. Buena base, mantener.

### Botones

- 3 variantes visualmente predominantes en uso real: `default` (fondo
  primary — casi negro, poco usado como CTA porque no se distingue de
  texto), `outline` (el más usado, para casi todas las acciones: Registrar,
  Agregar, Guardar nota, Editar), `ghost` (Completar, acciones terciarias).
- **Inconsistencia de jerarquía real**: acciones que deberían ser primary
  (crear una captación, registrar una oferta, guardar un formulario) están
  en `variant="outline"` en casi toda la app — visualmente al mismo nivel
  que "Ver tabla" o "Cancelar". No hay diferenciación entre CTA principal y
  acción secundaria.
- Tamaños: `xs`, `sm`, `default`, `lg` + variantes icon — bien definidos en
  el componente, pero el uso real solo alterna entre `default` y `sm` sin un
  criterio claro de cuándo usar cada uno (a veces por pantalla, no por
  jerarquía de acción).

### Forms

- `Input`/`Select`/`Textarea` con altura `h-8` consistente — bien.
- Sin `label` visible en varios formularios inline (ej. "Nueva tarea",
  "Registrar actividad" en ficha cliente/propiedad) — se apoyan solo en
  `placeholder`, lo cual falla accesibilidad (punto 86 de la spec) y
  jerarquía visual del formulario.
- No existe un patrón visual unificado de "helper text" ni "error" a nivel
  de campo individual — los errores de Server Actions se muestran como un
  bloque rojo arriba de toda la página (`/login`), no en el campo.

### Tables

- Un solo componente `Table` bien construido (`components/ui/table.tsx`),
  reusado consistentemente. Densidad ya razonable (`h-10` header, `p-2`
  celdas) — no hay filas gigantes.
- Row actions: no auditado en detalle por pantalla, pero no se detectaron
  patrones de "6 iconos por fila" — la mayoría de tablas usan un link
  principal por fila más badges de estado.

### Sidebar / Header

- Sidebar (`components/app-sidebar.tsx`): ya sigue casi al pie de la letra
  la estructura pedida en el punto 21 de la spec — secciones agrupadas
  ("Clientes", "Inventario") con `SidebarGroupLabel`, ítem activo resaltado
  vía el propio componente base de `sidebar.tsx`. **Única diferencia real
  con la spec**: agrupa "Propiedades / Búsquedas / Captaciones / Operaciones"
  bajo "Inventario" en vez de separar "NEGOCIO" (propiedades, captaciones,
  búsquedas, operaciones) de "GESTIÓN" (tareas, dashboard) — pero hoy no
  existe un ítem de nav para "Tareas" como sección propia (las tareas viven
  dentro de "Hoy" y de cada ficha). Dashboard queda solo, sin agrupar.
- Header (`components/app-header.tsx`): muy minimalista — solo
  `SidebarTrigger` + avatar/logout. **No existe búsqueda global, ni command
  palette (⌘K), ni botón "+ Nuevo" global** (puntos 25-27 de la spec) — hoy
  cada pantalla tiene sus propios botones de creación dispersos en el header
  de cada page, sin un patrón unificado.

### Tabs / Dialogs / Drawers

- `Tabs` (Base UI) usado en ficha de propiedad (Resumen/Interesados/
  Visitas/Ofertas/Actividad, agregadas incrementalmente en V2). No auditado
  visualmente a fondo — reservado para Bloque UI-4.
- No hay uso de `Sheet`/drawer en el código actual pese a existir el
  componente (`components/ui/sheet.tsx`) — todas las acciones rápidas
  (nueva tarea, nueva nota, registrar oferta) son formularios inline dentro
  de `Card`s de la propia página, no drawers. Esto empuja mucho scroll
  vertical en fichas de cliente/propiedad (contacts/[id]/page.tsx tiene 9
  `Card`s apiladas al mismo nivel).

### Estados de carga / vacío / error

- Empty states: mensajes de texto simple (`text-muted-foreground text-sm`,
  ej. "Sin tareas para hoy.") — ya alineado con el punto 60 de la spec (sin
  ilustraciones). Falta el patrón de empty state con CTA embebido
  (ej. "No hay ofertas todavía. [Registrar oferta]") — hoy son solo texto,
  nunca incluyen una acción.
- Loading: existe `components/ui/skeleton.tsx` pero no se encontró ningún
  uso real (`Suspense` + skeleton) en las páginas auditadas — las páginas son
  Server Components que esperan la data completa antes de renderizar nada.
- No se auditaron toasts (`sonner.tsx` existe, uso disperso en varias
  acciones) en profundidad — reservado para Bloque UI-9.

### Mobile

- Ya documentado en `docs/ARCHITECTURE.md` (Bloque H, V2): bug real de
  `flex-1` sin `min-w-*` en inputs dentro de contenedores `flex-wrap`, ya
  corregido en 13 instancias. Sidebar colapsa a ícono/drawer vía el
  componente base — comportamiento estándar de shadcn sidebar, no auditado
  a fondo pantalla por pantalla todavía (reservado para Bloque UI-8).

## 2. Inconsistencias detectadas

| #   | Inconsistencia                                                                                                                                                   | Dónde                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Mismo estado de negocio (activo/vencido/cerrado/cancelado) siempre con el mismo gris — cero distinción visual de urgencia o resultado                            | Todas las fichas y listados (17 archivos con `<Badge variant="secondary">`) |
| 2   | Acciones que deberían ser CTA principal (crear, guardar, registrar) están en `variant="outline"`, indistinguibles de acciones secundarias                        | Prácticamente toda la app                                                   |
| 3   | `CardTitle` con jerarquía tipográfica inconsistente entre pantallas (`text-sm` puro vs. `text-muted-foreground text-sm font-medium`)                             | `today/page.tsx` vs. `contacts/[id]/page.tsx`, `dashboard/page.tsx`         |
| 4   | `Card` variante `size="sm"` existe pero nunca se usa — todas las cards (incluso KPIs de una sola cifra) llevan el padding grande por defecto                     | `dashboard/page.tsx` (KPI cards), `today/page.tsx`                          |
| 5   | Fichas de cliente/propiedad son una pila plana de 8-9 `Card`s del mismo peso visual, sin agrupar por importancia (identidad vs. actividad vs. datos secundarios) | `contacts/[id]/page.tsx`, `properties/[id]/page.tsx`                        |
| 6   | Sin búsqueda global ni CTA "+ Nuevo" unificado — cada página resuelve la creación de registros a su manera                                                       | Header global, todas las páginas de listado                                 |
| 7   | Formularios inline sin `label` visible, solo `placeholder`                                                                                                       | Ficha cliente ("Nueva tarea", "Registrar actividad"), ficha propiedad       |
| 8   | Empty states nunca incluyen una acción (CTA) embebida                                                                                                            | Todos los `emptyMessage` de listas                                          |
| 9   | No existe patrón de loading skeleton pese a tener el componente                                                                                                  | Toda la app (Server Components sin `Suspense`)                              |

## 3. Clasificación KEEP / REFINE / REPLACE

| Elemento                                                      | Clasificación                              | Motivo                                                                             |
| ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Paleta base OKLCH / arquitectura de tokens (`@theme inline`)  | **KEEP**                                   | Ya es una arquitectura de tokens correcta, solo falta ampliarla con semántica      |
| Escala de spacing (4/8/12/16/24/32 vía Tailwind)              | **KEEP**                                   | Ya coherente, sin arbitrarios                                                      |
| Escala de radius tokenizada                                   | **KEEP**                                   | Ya correcta                                                                        |
| `Card` con `ring` en vez de `shadow`                          | **KEEP**                                   | Ya sigue el principio border > shadow                                              |
| Tipografía (familia Geist)                                    | **KEEP**                                   | No cambiar por moda                                                                |
| `Table` component                                             | **KEEP**                                   | Ya denso y consistente                                                             |
| Sidebar (estructura, agrupación)                              | **REFINE**                                 | Reagrupar secciones (NEGOCIO/GESTIÓN), no reconstruir                              |
| Color primario (gris neutro sin marca)                        | **REFINE**                                 | Adoptar azul profesional (`#2563EB`) como primary, sin marca previa que conservar  |
| Tokens semánticos (success/warning/danger/neutral)            | **REPLACE** (crear desde cero, no existen) | Ausencia total hoy                                                                 |
| Badges de estado por pantalla (17 implementaciones repetidas) | **REPLACE**                                | Centralizar en un `StatusBadge` con mapeo semántico por dominio                    |
| Jerarquía de botones (primary/secondary/ghost mal aplicada)   | **REFINE**                                 | El componente está bien, el _uso_ está mal — pasar CTAs reales a `default`/primary |
| `CardTitle` inconsistente entre pantallas                     | **REFINE**                                 | Unificar un solo patrón de header de sección                                       |
| Header global (sin búsqueda/⌘K/+Nuevo)                        | **REFINE**                                 | Ampliar sin reconstruir — se aborda en Bloque UI-2                                 |
| Ficha cliente / ficha propiedad (pila plana de cards)         | **REFINE**                                 | Reordenar jerárquicamente sin tocar la lógica de datos — Bloque UI-4               |
| Formularios inline sin label                                  | **REFINE**                                 | Agregar labels visibles manteniendo el mismo markup de Server Action               |
| Empty states sin CTA                                          | **REFINE**                                 | Agregar acción embebida donde exista una acción de creación natural                |
| Loading states                                                | **REPLACE** (crear desde cero)             | No existen hoy — se evalúa alcance en Bloque UI-9                                  |

## 4. Metodología

- Lectura completa de `components/ui/{button,badge,card,table,input}.tsx`,
  `app/globals.css`, `components/app-sidebar.tsx`, `components/app-header.tsx`,
  `app/(dashboard)/layout.tsx`.
- Lectura completa de las páginas `/today`, `/dashboard`, `/contacts/[id]`,
  y los primeros ~180 líneas de `/properties/[id]` y `/acquisitions`.
- `grep` dirigido para: usos de color Tailwind crudo, usos de `Badge`,
  patrones de `variant=`, uso de `Card size="sm"`, uso de `Sheet`.
- Verificación en vivo vía Claude Browser contra `localhost:3000` (servidor
  de desarrollo, mismo proyecto Supabase hosteado que producción): login,
  shell de la app, estados vacíos de `/today`. La organización de prueba no
  tiene datos cargados todavía — la auditoría de pantallas con datos reales
  (tablas pobladas, Kanban con tarjetas, gráficos del dashboard) se completa
  con datos de prueba sembrados y limpiados durante la implementación de
  cada Bloque, siguiendo la misma convención de testing usada en V2.
