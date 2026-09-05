# Roadmap

Implementación incremental. No se arranca una fase sin haber cerrado la
anterior con `lint` + `typecheck` + `build` (y tests, cuando existan) en
verde, y un commit prolijo.

## Fase 0 — Fundación ✅ (este commit)

- Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui (estilo `base-nova`,
  sobre Base UI).
- Supabase: `organizations`, `memberships`, `profiles`, RLS base, función
  `create_organization()`, trigger `handle_new_user()`.
- Auth: email/password + magic link (Supabase Auth), callback route,
  proxy de sesión (`proxy.ts`).
- Onboarding: alta de organización en el primer login.
- Layout con sidebar (todas las secciones del nav, con placeholders
  "Coming soon" para lo no construido) + header con menú de usuario.
- Pantalla "Hoy" (esqueleto, sin datos reales todavía).
- `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`,
  `docs/ROADMAP.md`.

## Fase 1 — CRM Core

- Tablas: `contacts`, `contact_roles`, `notes`, `tasks`, `activities` (+RLS).
- Ficha de contacto: datos, roles, notas, tareas, timeline básico.
- Acciones rápidas desde la ficha (agregar nota, crear tarea, registrar
  llamada).
- Detección de posibles duplicados por teléfono/email/DNI antes de crear un
  contacto.
- Primeros tests: validaciones Zod, RLS de `contacts`.

## Fase 2 — Propiedades

- Tablas: `properties`, `property_owners`.
- Listado con filtros (estado, operación, zona, precio, propietario) y ficha
  con timeline.

## Fase 3 — Captaciones

- Tablas: `property_acquisitions`, `valuations`.
- Kanban de captaciones con drag & drop; vista tabla alternativa.

## Fase 4 — Búsquedas

- Tabla `property_searches`, pipeline de comprador, filtros combinables
  (zona + tipo + presupuesto + dormitorios + objetivo + urgencia).

## Fase 5 — Leads

- Tabla `leads`, inbox comercial, conversión lead → contacto + búsqueda sin
  duplicar datos.

## Fase 6 — Operaciones

- Tabla `deals`, pipeline venta/alquiler, timeline de hitos legales,
  comisión estimada.

## Fase 7 — Hoy

- Pantalla "Hoy" completa: agenda del día, tareas, seguimientos vencidos,
  alertas comerciales (todas clickeables). Se convierte en el centro real
  del CRM una vez que Fases 1–6 alimentan datos reales.

## Fase 8 — Agenda

- Calendario interno (mensual/semanal/diario), creación/edición de
  actividades desde contacto/propiedad/operación.

## Fase 9 — Google Calendar

- OAuth 2.0, sincronización unilateral CRM → Calendar (`google_event_id`),
  create/update/cancel, refresh token seguro, sin loguear tokens.
  Calendar → CRM queda documentado como fase futura, no implementado.

## Fase 10 — Dashboard

- KPIs accionables (leads, visitas, ofertas, reservas, cierres, comisiones)
  y embudos de comprador/captación, por período.

## Fase 11 — Matching

- `match_score` determinístico (0–100) propiedad ↔ búsqueda, sin IA.

## Fase 12 — Fidelización

- Estados relacionales (`past_client`, `follow_up`, `referrer`), tareas
  automáticas de seguimiento postventa/aniversario/cumpleaños (sin envío
  automático de mensajes).

## Explícitamente fuera de estas fases

Portal público, publicación automática en portales, WhatsApp Business API,
email marketing, firma electrónica, contratos automáticos, tasación con IA,
facturación, permisos de equipo avanzados, app nativa, capa de IA de
parseo de texto libre (documentada como visión futura en
docs/PRODUCT_SPEC.md, no construida hasta que el core esté estable).
