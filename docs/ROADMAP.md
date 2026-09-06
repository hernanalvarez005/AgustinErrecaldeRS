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

## Fase 5 — Leads ✅

- Tabla `leads` (first_name obligatorio, resto opcional — la carga manual
  de una consulta cruda no debería exigir todos los datos), `notes`/`tasks`/
  `activities` ganaron `lead_id`. Vista `lead_overview` con
  `next_action_at`.
- `/leads`: inbox con nombre, contacto, mensaje, origen, estado, fecha de
  ingreso y próxima acción, con filtros por origen/estado/texto.
- `/leads/new` y `/edit`: carga y edición manual (portal, WhatsApp,
  Instagram, referido...), con selector opcional de la propiedad de
  interés.
- `/leads/[id]`: cambio de estado, conversión, actividad/tareas/notas/
  timeline (mismo patrón de engagement compartido).
- Conversión lead → contacto + búsqueda: reutiliza `findPossibleDuplicates`
  de Fase 1 (avisa, nunca bloquea) y el formulario de búsqueda completo de
  Fase 4 (`/searches/new?contactId=&leadId=`) en vez de duplicar campos —
  ver docs/DATABASE.md para el flujo completo. Verificado en vivo: vincular
  a un contacto existente, crear uno nuevo, y forzar la creación pese a un
  duplicado detectado — en los tres casos, cero contactos duplicados.

Pendiente de esta fase, movido a después: tests automatizados (mismo
criterio que Fases 1-4).

## Fase 6 — Operaciones ✅

- Tabla `deals` (buyer_contact_id/seller_contact_id obligatorios — a
  diferencia de una captación o una búsqueda, una operación solo existe
  con comprador y vendedor concretos), pipeline propio (negociación →
  oferta → reserva → documentación → contrato → escrituración →
  cerrada/cancelada). `notes`/`tasks`/`activities` ganaron `deal_id`.
  Vista `deal_overview` con `last_interaction_at`/`next_action_at`
  calculados desde el primer momento (no repite el bug real de Fase 3
  recién corregido).
- `/deals`: Kanban con drag & drop (reutilizando los tres fixes de
  `@dnd-kit` documentados en docs/ARCHITECTURE.md) + vista tabla
  (`?view=table`).
- `/deals/new`: elige propiedad + comprador + vendedor + tipo de
  operación + precio de publicación.
- `/deals/[id]`: formulario de "precios y fechas clave" (oferta, precio
  acordado, fechas de reserva/contrato/escrituración, comisión estimada),
  registro de actividad, tareas, notas, timeline.
- Extraído `components/properties/property-select-field.tsx`: mismo
  patrón de degradar a input oculto con una sola opción que
  `ContactSelectField`, ahora para propiedades.
- **Bug real encontrado y corregido (Fase 3):** `property_acquisitions.
next_action_at` era una columna que nada escribía nunca — "Próxima
  acción" en Captaciones mostraba siempre "—" desde que existe la fase.
  Reemplazada por `acquisition_overview` (mismo patrón de vista calculada
  que el resto de las entidades). Ver docs/DATABASE.md.

Pendiente de esta fase, movido a después: tests automatizados (mismo
criterio que Fases 1-5).

## Fase 7 — Hoy ✅

- `/today` completo: agenda del día (actividades `scheduled` de hoy —
  queda vacío hasta que la Fase 8 agregue una forma de agendarlas),
  tareas para hoy, seguimientos vencidos, alertas comerciales — las
  cuatro secciones con datos reales de Fases 1-6 y **todo clickeable**.
- Resolución de link genérica (`lib/data/today.ts`): una tarea o
  actividad puede estar atada a contacto/propiedad/captación/búsqueda/
  lead/operación — antes solo se resolvía el link cuando había
  `contact_id`; cualquier tarea de las Fases 2-6 quedaba con un link
  muerto (`href="#"`). Corregido con un resolver que cubre los seis
  casos, con label específico para cada uno.
- Alertas comerciales reales: cuenta búsquedas/captaciones/operaciones
  activas sin próxima acción (regla de negocio 5 del spec), cada una
  clickeable a su listado.
- **Bug real corregido:** los límites de "hoy" se calculaban con
  `new Date()` en la zona horaria implícita del proceso — mismo patrón
  de bug que el de fechas de Fase 4, pero en una consulta en vez de en
  un `format`. Nuevo `lib/date.ts` centraliza el cálculo de "hoy" en la
  zona horaria del negocio (Argentina), independiente de la zona del
  servidor. Ver docs/ARCHITECTURE.md.

Pendiente de esta fase, movido a después: tests automatizados (mismo
criterio que Fases 1-6).

## Fase 8 — Agenda ✅

- `/calendar`: vistas mensual/semanal/diaria (todas server-rendered, sin
  drag-and-drop — reprogramar es editar la fecha del formulario), todas
  navegables entre sí y con anterior/siguiente/hoy. Reutiliza la tabla
  `activities` que ya existía desde Fase 1 — sin migración esta fase.
- `/calendar/new` y `/calendar/[id]/edit`: creación/edición de eventos con
  tipo, inicio/fin, ubicación, link de reunión, estado, y vínculo opcional
  a contacto/propiedad/operación (los tres que pide el spec). Cierra un
  hueco real: hasta esta fase no existía ninguna forma de crear una
  `activity` con `status='scheduled'` — el registro rápido
  (`logActivity`) siempre crea actividades ya `completed`. "Agenda de
  hoy" en `/today` (Fase 7) pasa de estar siempre vacía a mostrar datos
  reales.
- "+ Agendar" agregado a las fichas de contacto/propiedad/operación,
  linkeando a `/calendar/new?contactId=/propertyId=/dealId=`.
- Nuevo `lib/date.ts` extendido con aritmética de grilla de calendario
  (mes/semana) y con la conversión de ida y vuelta entre un
  `<input type="datetime-local">` y un instante UTC correcto — ver el
  gotcha nuevo en docs/ARCHITECTURE.md (fechas-hora sin zona se parsean
  distinto que fechas solas).
- De paso, dos bugs cosméticos reales encontrados y corregidos: el saludo
  de `/today` calculaba el día de la semana con la zona horaria implícita
  del proceso (mismo patrón que los gotchas de Fases 4/7, ahora
  centralizado); y `text-transform: capitalize` en CSS mayusculiza cada
  palabra, rompiendo "6 de septiembre" → "6 De Septiembre" — corregido
  mayusculizando solo la primera letra en JS.

Pendiente de esta fase, movido a después: tests automatizados (mismo
criterio que Fases 1-7); sincronización con Google Calendar (Fase 9).

## Fase 9 — Google Calendar ✅

- OAuth 2.0 (authorization code, `access_type=offline` + `prompt=consent`
  para garantizar refresh_token) contra la Calendar API. Conexión 1:1 por
  usuario (`google_calendar_connections`, sin `organization_id` — mismo
  patrón que `profiles`), gestionable desde Configuración
  (conectar/desconectar).
- Sincronización unilateral CRM → Calendar: `/calendar/new` y
  `/calendar/[id]/edit` (y el botón rápido "Cancelar" del listado) crean/
  actualizan/eliminan el evento espejo en Google, guardando
  `activities.google_event_id` (columna que ya existía desde Fase 1, sin
  usar hasta ahora). Solo eventos `scheduled`/editados a
  `completed`/`cancelled` — el registro rápido de actividades ya
  ocurridas no sincroniza (no tiene sentido llevar un historial al
  calendario). Calendar → CRM queda fuera de alcance, documentado como
  fase futura.
- Sincronización best-effort: un fallo de la API de Google nunca bloquea
  guardar el registro del CRM, que sigue siendo la fuente de verdad.
- Refresh automático del access token (con margen de 1 minuto) antes de
  cada llamada; nunca se loguea un token, ni en éxito ni en error.

Pendiente de esta fase, movido a después: tests automatizados (mismo
criterio que Fases 1-8); Calendar → CRM (sincronización bidireccional).

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
