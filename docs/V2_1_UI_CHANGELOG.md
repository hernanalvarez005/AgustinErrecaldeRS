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
- Tonos semánticos como *significado*, no *enum*: cada dominio tiene su
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
