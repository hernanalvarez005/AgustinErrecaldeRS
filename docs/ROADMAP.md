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

## Fase 1 — CRM Core ✅

- Tablas: `contacts`, `contact_roles`, `notes`, `tasks`, `activities` (+RLS),
  vista `contact_overview` para el listado sin N+1.
- `/contacts`: buscador (nombre/teléfono/email) + filtro por rol.
- `/contacts/new` y `/contacts/[id]/edit`: mismo formulario, con detección de
  posibles duplicados por teléfono/email/DNI antes de guardar (no bloquea,
  avisa).
- `/contacts/[id]`: header con roles y accesos directos (llamar, WhatsApp,
  email), última interacción/próxima acción a la vista, tareas pendientes
  con alta y completado rápido, notas, registro de actividad (llamada,
  WhatsApp, email, reunión, visita, otro) y timeline unificado.
- "Hoy" ahora muestra tareas reales del día y seguimientos vencidos
  (agenda y alertas comerciales siguen pendientes de Fases 8/3+).

Pendiente de esta fase, movido a después: tests automatizados (unit/RLS) —
no bloquearon el MVP funcional pero quedan como deuda a pagar antes de sumar
más superficie (ver docs/ARCHITECTURE.md).

## Fase 2 — Propiedades ✅

- Tablas: `properties`, `property_owners` (+RLS), vista `property_overview`
  para el listado sin N+1. `notes`/`tasks`/`activities` ganaron `property_id`
  (columna nullable, sin tocar la migración de Fase 1).
- Se generalizó la capa de notas/tareas/actividades (`lib/data/engagement.ts`,
  `lib/actions/engagement.ts`) para que contactos y propiedades compartan la
  misma lógica en vez de duplicarla.
- `/properties`: buscador (título/ciudad/barrio) + filtro por operación y
  estado.
- `/properties/new` y `/properties/[id]/edit`: mismo formulario.
- `/properties/[id]`: propietarios (agregar desde contactos existentes, con
  % de tenencia y marca de "principal"; quitar), registro de actividad,
  tareas, notas y timeline unificado — mismos patrones que la ficha de
  contacto.

Pendiente de esta fase, movido a después: tests automatizados (mismo
criterio que Fase 1).

## Fase 3 — Captaciones ✅

- Tablas: `property_acquisitions`, `valuations` (+RLS). `notes`/`tasks`/
  `activities` ganaron `acquisition_id`.
- `/acquisitions`: Kanban con drag & drop (`@dnd-kit/core`) + vista tabla
  (`?view=table`); mover una tarjeta actualiza el estado.
- `/acquisitions/new`: arranca desde "propietario interesado en vender" —
  crea la propiedad (mínima), el vínculo de propiedad y la captación juntos.
- `/acquisitions/[id]`: tasaciones (alta + listado), marcar perdida (con
  motivo opcional), registro de actividad, tareas, notas, timeline.
- Extraído `components/contacts/contact-select-field.tsx`: picker de
  contacto reutilizable que evita el bug de shadcn `Select` con una sola
  opción (ver docs/ARCHITECTURE.md) — ya usado en propiedades y captaciones.

Pendiente de esta fase, movido a después: tests automatizados (mismo
criterio que Fases 1-2).

## Fase 4 — Búsquedas ✅

- Tabla `property_searches` (contact_id obligatorio — una búsqueda siempre
  pertenece a un cliente, nunca a una propiedad), pipeline de comprador
  (`status`, 10 valores), filtros combinables (zona + tipo + presupuesto +
  dormitorios + objetivo + urgencia). `notes`/`tasks`/`activities` ganaron
  `search_id`. Vista `search_overview` (`security_invoker`) con join a
  `contacts` para nombre + `last_interaction_at`/`next_action_at`.
- `/searches`: listado con las 8 columnas del punto 26 del spec (cliente,
  objetivo, tipo, zona, presupuesto, estado, última interacción, próxima
  acción) + filtros combinables.
- `/searches/new`: soporta `?contactId=` para preseleccionar cliente desde
  la ficha de contacto (botón "+ Nueva búsqueda" en `/contacts/[id]`).
- `/searches/[id]`: edición de campos de la búsqueda, cambio de estado del
  pipeline, registro de actividad, tareas, notas, timeline (mismo patrón
  de "engagement" que contactos/propiedades/captaciones).
- `lib/validations/shared.ts` centralizado como única fuente de la
  normalización de campos vacíos (ver docs/ARCHITECTURE.md — bug real
  encontrado en esta fase).

Pendiente de esta fase, movido a después: tests automatizados (mismo
criterio que Fases 1-3).

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
