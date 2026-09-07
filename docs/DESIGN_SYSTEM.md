# Design System — CRM Inmobiliario (V2.1)

Fuente de verdad visual del proyecto a partir de V2.1. Construido **sobre**
el sistema de tokens que ya existía (shadcn + Tailwind v4 `@theme inline`),
no reemplazándolo — ver `docs/V2_1_UI_AUDIT.md` para el detalle de qué se
mantuvo, refinó o reemplazó.

## Principios

Sobria · moderna · ligera · profesional · densa pero legible · consistente ·
rápida. Herramienta de trabajo diario, no landing page. El color comunica
acción/estado/prioridad, nunca decoración.

## Tokens

Definidos en [app/globals.css](../app/globals.css), expuestos a Tailwind vía
`@theme inline`. Los valores base viven en `:root`/`.dark`; `@theme inline`
solo los mapea a utilidades (`bg-primary`, `text-success`, etc.).

### Color — estructura

```
--background        canvas de la app (gris extremadamente sutil)
--surface (card)     superficie de paneles/cards (blanco)
--border             borde default
--border-strong      borde con más énfasis (dividers importantes, focus ring base)

--text-primary (foreground)     texto principal
--text-secondary                texto secundario
--text-muted (muted-foreground) metadata, timestamps, ayudas

--primary            color de marca — único, azul profesional (#2563EB en light)
--primary-foreground texto sobre superficie primary
--primary-subtle     fondo tenue de primary (selección, item activo de sidebar)

--success / --success-subtle
--warning / --warning-subtle
--danger  / --danger-subtle   (alias del --destructive ya existente)
--neutral / --neutral-subtle  (estado "sin actividad", archivado, pausado)
```

### Semántica de estado — regla única

No mapear un color por cada valor de enum. Mapear por **significado**:

| Significado                             | Token     | Ejemplos de uso (uno por dominio, no exhaustivo)               |
| --------------------------------------- | --------- | -------------------------------------------------------------- |
| Sin iniciar / informativo               | `neutral` | `new` (lead), `archived`/`paused` (propiedad, búsqueda)        |
| En curso / requiere acción del usuario  | `primary` | `contacted`, `in_progress`, `active`                           |
| Requiere atención / por vencer          | `warning` | tareas vencidas, "requiere seguimiento", próximos vencimientos |
| Resultado favorable / cerrado con éxito | `success` | `won`, `closed`, `accepted`, captación lograda                 |
| Resultado negativo / cancelado          | `danger`  | `lost`, `cancelled`, `rejected`, error                         |

Este mapeo se implementa una sola vez por dominio en
`lib/status-tone.ts` (Bloque UI-1) y lo consume el componente `StatusBadge`
— las páginas dejan de decidir color, solo pasan el valor del enum.

### Typography

Familia: la ya existente (`--font-sans`, Geist). No se cambia.

| Uso                           | Tamaño               | Peso                                  |
| ----------------------------- | -------------------- | ------------------------------------- |
| Page title                    | 24px (`text-2xl`)    | semibold                              |
| Section heading (`CardTitle`) | 14px (`text-sm`)     | semibold — unificado, ver Bloque UI-1 |
| Body                          | 14px (`text-sm`)     | normal                                |
| Metadata secundaria           | 13px (`text-[13px]`) | normal, `text-muted-foreground`       |
| Labels pequeños               | 12px (`text-xs`)     | medium                                |

### Spacing

Escala Tailwind estándar ya en uso: `4 · 8 · 12 · 16 · 24 · 32`. No se
introducen valores nuevos. `--card-spacing` sigue existiendo (`Card`
default = 16px, `size="sm"` = 12px) — V2.1 empieza a usar `size="sm"` donde
corresponda (KPIs, badges dentro de listas densas).

### Radius

Escala ya tokenizada (`--radius` base 10px + derivados `sm/md/lg/xl/2xl`).
Sin cambios — ya evita la mezcla arbitraria que pide evitar la spec.

### Borders / Shadows

Regla: `border`/`ring` sutil por defecto, sombra reservada para overlays
flotantes (dropdown, popover, dialog) que ya la usan vía Base UI. `Card`
sigue usando `ring-1 ring-foreground/10`, no `shadow-*`.

### Iconografía

Lucide (`lucide-react`), única librería — ya es así en todo el código
actual, se mantiene. Tamaño default `16px` (`size-4`), `14px` (`size-3.5`)
en contexto denso de texto inline.

### Botones — jerarquía

Máximo 3 niveles reales de uso (el componente ya soporta más variantes por
compatibilidad, pero el _criterio de uso_ se limita a 3):

- **Primary** (`variant="default"`): una sola acción por vista — crear,
  guardar, confirmar. Ejemplo: "+ Nueva captación", "Guardar", "Registrar
  oferta".
- **Secondary** (`variant="outline"`): acciones de apoyo — editar, agendar,
  reprogramar, cambiar de vista.
- **Ghost** (`variant="ghost"`): terciarias — cancelar, completar tarea
  inline, acciones dentro de listas densas.

Tamaños: `default` para formularios/CTAs de página, `sm` dentro de tablas,
listas y toolbars densos.

### StatusBadge

Componente nuevo (`components/shared/status-badge.tsx`, Bloque UI-1) sobre
el `Badge` existente — no lo reemplaza, lo envuelve: recibe un `tone`
(`neutral/primary/warning/success/danger`) resuelto por los helpers de
`lib/status-tone.ts`, y aplica automáticamente los tokens `*-subtle` como
fondo y el tono como texto/borde. Mismo tamaño/forma que `Badge` (pill,
`h-5`, `text-xs`).

## Componentes del design system (V2.1)

Construidos solo donde aportan reutilización real (punto 91 de la spec —
evitar sobreabstracción). Ver `docs/V2_1_UI_CHANGELOG.md` a medida que se
crean, con el archivo y el Bloque en que se introdujo cada uno.

Candidatos identificados en la auditoría (se crean bajo demanda, en el
Bloque que primero los necesita, no todos de una vez):

- `StatusBadge` — Bloque UI-1
- `PageHeader` (título + acciones de página, reemplaza el `<div className="flex items-center justify-between">` repetido en cada page.tsx) — Bloque UI-2
- `SectionHeader` (unifica el patrón `CardHeader`+`CardTitle` con tamaño/peso consistente) — Bloque UI-1
- `EmptyState` (mensaje + CTA opcional) — donde primero se necesite un empty state accionable
- `KpiCard` — Bloque UI-7 (dashboard)
- `Timeline` — ya existe (`components/contacts/timeline.tsx`), evaluar generalizar en Bloque UI-4

No se crean `DataTable`, `FilterBar`, `EntityHeader`, `QuickActions`,
`Metric`, `ActivityRow` genéricos hasta que un Bloque concreto los necesite
— crearlos por adelantado violaría el punto 91 (no sobreabstraer).

## Qué NO se toca

Esquema de Supabase, rutas, lógica de negocio, nombres de tablas/FKs,
librerías (`@base-ui/react`, `class-variance-authority`, Lucide, Tailwind
v4) — ver reglas 1 y 96 de la especificación V2.1.
