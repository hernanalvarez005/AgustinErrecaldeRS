# V2 Evolution Plan

Este documento es el resultado de la auditoría dirigida pedida en la
especificación V2 (2026-09-06) — **no** una auditoría genérica del
proyecto. Cubre únicamente lo que la especificación toca. La regla
general en todo este plan es la de la propia especificación:

```
REUTILIZAR > EXTENDER > REFINAR > REFACTORIZAR > RECONSTRUIR
```

**Estado de partida (V1):** 12 fases completas y en producción (`main`,
commit `6b18b6a` al momento de escribir esto) — ver `docs/ROADMAP.md`.
Nada se reconstruye. Toda tabla/vista/componente mencionado abajo como
"reutilizar" ya existe y funciona; los cambios son incrementales.

## Cómo leer la tabla

- **Reutilizar**: se usa tal cual, sin tocar código ni schema.
- **Modificar**: cambio incremental sobre algo existente (columna nueva,
  vista extendida, UI reordenada) — nunca se borra ni recrea nada.
- **Nuevo**: no existe una estructura equivalente; se crea.
- **Riesgo**: probabilidad/impacto de romper un flujo ya en uso.

---

## Bloque A — UX operacional (Hoy) ✅ implementado

Implementado tal como se planeó abajo, sin migración. Cambios reales
sobre el plan original, encontrados durante la implementación:

- El filtro de "Agenda de hoy" se mantuvo en `status = 'scheduled'` (no
  se amplió a "no cancelado" como se consideró al planificar): el
  registro rápido de actividades (`logActivity`) inserta actividades ya
  `completed` con `starts_at: now()`, así que ampliar el filtro habría
  inundado la agenda de hoy con cada llamada/WhatsApp registrado en el
  día, contradiciendo el propio objetivo de "entender en 10 segundos qué
  tiene hoy". Se agregó `status` al tipo/consulta de todos modos (para
  cumplir el pedido explícito de "mostrar estado"), pero el filtro que
  decide qué aparece no cambió.
- "Reprogramar" quedó como una mini-form con `<input type="date">` +
  botón, reutilizando exactamente la convención de fecha de `createTask`
  (string plano "YYYY-MM-DD" → `new Date(...).toISOString()`).
- "WhatsApp" en Seguimientos solo aparece cuando la task tiene un
  `contact_id` DIRECTO con teléfono — no se tocó `resolveEngagementLinks`
  (usado también por `/calendar`) para no arriesgar ese contrato
  compartido; se agregó una función aditiva (`attachWhatsAppLinks`) al
  lado.
- Verificado end-to-end contra Supabase real: alerta de "seguimientos
  vencidos" (link de anclaje a la card de abajo), "leads sin responder"
  (link a `/leads?status=new`, confirmado que filtra), Reprogramar mueve
  una task fuera de "vencidos" y actualiza el contador en el mismo
  request, Completar la libera y hace aparecer "1 operación activa sin
  próxima acción" (la regla de "próxima acción global" funcionando en
  cadena), WhatsApp resuelve al `wa.me` correcto. Sin errores de consola
  ni de servidor.

Detalle original del plan:

| Mejora                                                           | Estado actual                                                                                                                                                                                                                | Reutilizar                                                                                          | Modificar                                                                                                                                                       | Nuevo                                                                                    | Riesgo                                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Header "Buenos días, [nombre] / [fecha]"                         | Ya existe casi igual en `app/(dashboard)/today/page.tsx` (Fase 7/8), zona horaria correcta vía `BUSINESS_TIMEZONE`                                                                                                           | Sí, tal cual                                                                                        | Ninguno                                                                                                                                                         | —                                                                                        | Ninguno                                                                         |
| "Requieren tu atención" (compacto, clickeable)                   | Existe `listCommercialAlerts` (`lib/data/today.ts`) para búsquedas/captaciones/operaciones sin próxima acción — falta leads sin responder y seguimientos vencidos como ítems del mismo bloque (hoy están en una card aparte) | `listCommercialAlerts`, `search_overview`/`acquisition_overview`/`deal_overview` (`next_action_at`) | Extender `listCommercialAlerts` con 2 alertas más (leads nuevos sin responder, seguimientos vencidos) y fusionar visualmente en un solo bloque compacto         | —                                                                                        | Bajo — es agregar filas a una función que ya filtra y cuenta; no toca escritura |
| Agenda de hoy (hora, tipo, cliente, propiedad, contexto, estado) | Existe (`listTodayActivities` + `resolveEngagementLinks`), muestra hora/tipo/contexto, pero no el estado (`scheduled`/`completed`/`cancelled`) explícito ni distingue cliente de propiedad en la etiqueta                    | `activities`, `resolveEngagementLinks`, calendario Fase 8                                           | Agregar `status` al tipo `TodayActivity` y mostrarlo; enriquecer el link resuelto para mostrar cliente + propiedad cuando ambos aplican                         | —                                                                                        | Bajo                                                                            |
| Seguimientos (Completar/Reprogramar/Abrir cliente/WhatsApp)      | Existe `TaskList` con "Completar" únicamente (vía `completeTask`)                                                                                                                                                            | `completeTask`, `TaskList`                                                                          | Agregar acciones rápidas: link "Abrir" (ya casi — falta WhatsApp inline si el link resuelve a un contacto), "Reprogramar" (nueva mini-acción: cambiar `due_at`) | Server action `rescheduleTask(context, taskId, newDueAt)` en `lib/actions/engagement.ts` | Bajo — no cambia el modelo, solo agrega una acción de escritura ya conocida     |
| Leads pendientes (no está en Hoy hoy)                            | `/leads` existe (Fase 5) con filtro por estado, pero Today no muestra nada de leads                                                                                                                                          | Tabla `leads`, `lead_overview`                                                                      | Nueva query `listUnansweredLeadsForToday` en `lib/data/today.ts` (status `new`, ordenado por `created_at` asc) + card en Today                                  | —                                                                                        | Bajo — solo lectura nueva                                                       |
| Operaciones activas con próximo hito                             | `deal_overview.next_action_at` existe; Today no muestra deals                                                                                                                                                                | `deal_overview`                                                                                     | Nueva query `listDealsNeedingAttentionForToday` (deals no cerrados con próxima acción hoy/vencida) + card en Today                                              | —                                                                                        | Bajo                                                                            |
| "Próxima acción" como regla global                               | Ya resuelto por `tasks` + `*_overview.next_action_at` en las 3 entidades pipeline; `leads`/`contacts` no tienen este concepto todavía (no lo piden explícitamente como pipeline)                                             | Todo lo anterior                                                                                    | Ninguno — el sistema ya es "una task futura = próxima acción", no se crea un sistema paralelo                                                                   | —                                                                                        | Ninguno                                                                         |

**Migraciones Bloque A:** ninguna.
**Archivos afectados:** `lib/data/today.ts`, `app/(dashboard)/today/page.tsx`, `lib/actions/engagement.ts` (nueva `rescheduleTask`).
**Riesgo de regresión:** bajo — todo el bloque es lectura nueva + una acción de escritura acotada (reprogramar) sobre una tabla ya usada en 6 pantallas distintas; no cambia ningún flujo existente.

---

## Bloque B — Captaciones ✅ implementado

Implementado tal como se planeó, con una pieza nueva no anticipada:

- `/acquisitions/quick` (captación rápida): formulario mínimo
  (propietario nombre/apellido/teléfono, dirección/referencia, tipo,
  precio estimado, origen, notas) con el mismo patrón de detección de
  duplicados que `components/leads/convert-lead-form.tsx` (avisa, nunca
  bloquea). Refactor real: la lógica de "crear propiedad + vínculo de
  propietario + captación" de `createAcquisition` se extrajo a
  `insertAcquisitionRecord` (función interna, no exportada) para que la
  captación rápida (tanto la rama "contacto nuevo" como "usar este
  contacto") reutilice exactamente el mismo camino de escritura que el
  formulario completo — nunca un segundo camino paralelo.
- Banner "Captación creada" en la ficha (`?created=1`) con las 4 acciones
  del spec: Completar propiedad, Crear seguimiento (ancla a la card de
  Tareas), Agendar reunión, Volver.
- Tabla enriquecida (Origen, Último contacto, Pendientes) y tarjetas del
  Kanban enriquecidas (Último contacto, Pendientes).
- Migración: `acquisition_overview` ganó `last_interaction_at` (mismo
  patrón que `search_overview`) y `pending_tasks_count` (nuevo en las 4
  vistas `*_overview`).
- Verificado end-to-end contra Supabase real: alta rápida completa,
  detección de duplicado por teléfono, "usar este contacto" vincula sin
  crear un contacto repetido (confirmado por consulta directa — 1 solo
  contacto para 2 captaciones), tabla y Kanban muestran los datos nuevos
  correctamente tras registrar una actividad y una tarea. Sin errores de
  consola ni de servidor.

Detalle original del plan:

| Mejora                                           | Estado actual                                                                                                                                                                                                                              | Reutilizar                                                                                          | Modificar                                                                                                                                                                                                 | Nuevo                                                                                               | Riesgo                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Captación rápida (<30s)                          | Hoy `/acquisitions/new` ya crea contacto+propiedad+captación juntos (Fase 3) pero pide más campos que el mínimo del spec y no tiene detección de duplicados de contacto                                                                    | `createAcquisition` action, `findPossibleDuplicates` (Fase 1), `properties`/`property_acquisitions` | Agregar variante corta del formulario (mismo action, subset de campos: propietario, teléfono, dirección/referencia, tipo, precio estimado, origen, notas) + chequeo de duplicados antes de crear contacto | Opcional: `app/(dashboard)/acquisitions/quick/page.tsx` o un modo `?quick=1` en el `/new` existente | Medio — toca el flujo de creación que ya está en uso; mitigar reutilizando el mismo `createAcquisition` y solo variando el formulario, nunca la escritura |
| Pantalla post-guardado con próximos pasos        | Hoy redirige directo a `/acquisitions/[id]`                                                                                                                                                                                                | `/acquisitions/[id]` ya tiene "Registrar actividad"/"Tareas"                                        | Agregar un banner/estado `?created=1` con 3 CTAs (Completar propiedad, Crear seguimiento, Agendar) en la ficha en vez de una pantalla nueva                                                               | —                                                                                                   | Bajo                                                                                                                                                      |
| Tabla y Pipeline (ambas vistas)                  | **Ya existen las dos** (`?view=table` / Kanban) desde Fase 3                                                                                                                                                                               | `KanbanBoard` (acquisitions), tabla actual                                                          | Agregar a la tabla: Origen, Último contacto, Pendientes (hoy solo tiene Propiedad/Propietario/Valor/Próxima acción/Estado); agregar Último contacto + Pendientes a las tarjetas del Kanban                | —                                                                                                   | Bajo — agrega columnas, no cambia las existentes                                                                                                          |
| `acquisition_overview` sin `last_interaction_at` | **Gap real encontrado**: `search_overview` y `deal_overview` sí calculan `last_interaction_at`; `acquisition_overview` (migración de Fase 6) quedó sin ese campo — inconsistencia entre las 3 vistas gemelas                               | Patrón exacto de `search_overview`/`deal_overview`                                                  | Migración incremental: `create or replace view acquisition_overview` agregando el mismo subselect `max(activities.starts_at) as last_interaction_at`                                                      | —                                                                                                   | Bajo — `create or replace view` no rompe nada que ya lea `acquisition_overview.*` (agrega una columna, no quita)                                          |
| Conteo de "pendientes" (tareas) por captación    | No existe hoy (ninguna vista trae un `count` de tasks abiertas)                                                                                                                                                                            | `tasks`                                                                                             | Agregar al mismo `create or replace view` un `pending_tasks_count`                                                                                                                                        | —                                                                                                   | Bajo                                                                                                                                                      |
| Pipeline: no romper nomenclatura existente       | Estados actuales: `new_lead, contacted, meeting_scheduled, meeting_completed, valuation, proposal_sent, follow_up, won, lost` — ya cubren conceptualmente Nueva/Contactada/Reunión/Tasación/Propuesta/Seguimiento/Captada/Perdida del spec | Todo el enum actual                                                                                 | Ninguno                                                                                                                                                                                                   | —                                                                                                   | Ninguno — el spec pide explícitamente no tocar nomenclatura por diferencias menores                                                                       |

**Migraciones Bloque B:** 1 migración (`create or replace view acquisition_overview` con `last_interaction_at` + `pending_tasks_count`).
**Archivos afectados:** `lib/data/acquisitions.ts`, `app/(dashboard)/acquisitions/page.tsx`, `components/acquisitions/kanban-board.tsx`, `app/(dashboard)/acquisitions/new/page.tsx` (o nueva ruta `quick`), `app/(dashboard)/acquisitions/actions.ts`.
**Riesgo de regresión:** bajo-medio — el único punto sensible es el formulario de alta rápida, que debe seguir escribiendo por el mismo `createAcquisition` para no crear un segundo camino de datos.

---

## Bloque C — Ficha de propiedad ✅ implementado

Implementado con un ajuste real de alcance sobre el plan original:

- Tabs: solo se crearon **Resumen** y **Actividad** — "Interesados",
  "Visitas" y "Ofertas" no tienen todavía ninguna tabla/dato real
  (dependen de los Bloques D/E/G, no construidos aún) y "Documentación"
  nunca estuvo definida en ningún bloque de este plan. Crear esas tabs
  ahora habría violado la regla explícita del spec ("no crear tabs
  vacíos"). Se agregarán cuando el bloque correspondiente exista: Bloque
  D agrega la tab "Visitas", Bloque E "Ofertas", Bloque G "Interesados".
  El componente `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`
  (`components/ui/tabs.tsx`) ya estaba en el proyecto sin usar — primer
  uso real.
- Header enriquecido: propietario principal, fecha de captación, días en
  cartera, última actividad completada — todo calculado a partir de datos
  ya cargados en la página (sin queries nuevas para esto), más el botón
  "Agendar visita" reutilizando la ruta `/calendar/new?propertyId=`
  existente desde la Fase 8.
- "Resumen" incluye Rendimiento (días en cartera, visitas, precio actual,
  precio/m² — derivado, sin columna nueva), Historial de precios
  (nuevo), Propietarios (sin cambios) y Coincidencias (Fase 11, sin
  cambios) — "interesados"/"propiedades enviadas"/"ofertas" del
  rendimiento del spec quedan pendientes de los Bloques E/G, como
  anticipaba el plan original.
- Migración: `property_price_history` + trigger `security definer`
  (`properties_log_price_change`, dispara solo `when (old.price is
distinct from new.price)`) — mismo patrón que `create_organization()`/
  `handle_new_user()` de la Fase 0. Sin política de insert/update/delete
  para `authenticated`: la única escritura posible es la del trigger.
- Real gotcha, no un bug: `Date.now()` llamado directamente en el cuerpo
  de un Server Component dispara `react-hooks/purity` (regla nueva de
  React 19/Next 16, no vista en fases anteriores). Se resolvió agregando
  `daysSinceNow` a `lib/format.ts` (mismo criterio que `formatRelativeTime`,
  que ya llamaba `Date.now()` dentro de una función nombrada sin
  problema) — documentado ahí mismo para la próxima vez que haga falta
  una duración "hasta ahora".
- Verificado end-to-end contra Supabase real: cambio de precio real vía
  el formulario de edición → fila de historial creada automáticamente con
  el % correcto (125.000 → 120.000 = ↓4%, verificado exacto) sin que el
  código de la app la escriba; un segundo guardado que solo cambia la
  descripción (confirmado que sí persistió) NO generó una fila nueva —
  el trigger distingue correctamente cuándo el precio realmente cambió.
  Tabs cambian de contenido correctamente. Sin errores de consola ni de
  servidor.

Detalle original del plan:

| Mejora                                                                      | Estado actual                                                                                                                                                                                                                        | Reutilizar                                                     | Modificar                                                                                                                           | Nuevo                                                                                                                                                                 | Riesgo                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header con propietario/días en cartera/última actividad                     | Header actual (`app/(dashboard)/properties/[id]/page.tsx`) muestra título/tipo/operación/estado/precio/dirección — no propietario destacado, días en cartera ni última actividad                                                     | `getPropertyOwners`, `getActivities`                           | Agregar esos 3 datos calculados al header (días en cartera = `today - created_at`; última actividad = `max(activities.starts_at)`)  | —                                                                                                                                                                     | Bajo                                                                                                                                                                    |
| Tabs (Resumen/Interesados/Visitas/Ofertas/Documentación/Actividad)          | **No hay tabs hoy** — todo es un scroll vertical de Cards (Propietarios, Registrar actividad, Tareas, Notas, Timeline, Coincidencias de Fase 11)                                                                                     | `components/ui/tabs.tsx` (ya en el proyecto, sin usar todavía) | Reestructurar la página en tabs, migrando cada Card existente a la tab que le corresponde — sin perder ninguna funcionalidad actual | —                                                                                                                                                                     | Medio — es el cambio de UI más grande del plan; mitigar moviendo Cards completas sin tocar su lógica interna, tab por tab, verificando cada una en vivo antes de seguir |
| Resumen: rendimiento (interesados/enviadas/visitas/ofertas/días en cartera) | Parcialmente derivable: visitas = `activities` tipo `property_visit`; interesados/ofertas dependen de `property_recommendations`/`offers` (nuevas, Bloques E/G)                                                                      | `activities`                                                   | —                                                                                                                                   | Depende de Bloques E/G — el contador completo de "Resumen" se completa recién cuando esas tablas existan; el resto del bloque puede mostrarse antes con lo disponible | —                                                                                                                                                                       |
| Precio actual / precio por m²                                               | `properties.price`/`total_area` ya existen                                                                                                                                                                                           | `properties`                                                   | Cálculo derivado en la UI (`price / total_area`), sin columna nueva                                                                 | —                                                                                                                                                                     | Ninguno                                                                                                                                                                 |
| Propietario con WhatsApp/último contacto/próxima acción                     | Datos existen repartidos (`property_owners`, `activities`, `tasks`)                                                                                                                                                                  | Todo lo anterior                                               | Consolidar en un card de "Propietario" dentro de la tab Resumen                                                                     | —                                                                                                                                                                     | Bajo                                                                                                                                                                    |
| Historial de precios                                                        | **No existe** — `valuations` es tasación previa a la captación (`estimated_value`/`recommended_listing_price`), no un log de cambios del `properties.price` real. Confirmado por auditoría: ninguna tabla registra cambios de precio | —                                                              | —                                                                                                                                   | `property_price_history` + trigger en `properties` (ver abajo)                                                                                                        | Bajo — tabla aditiva, no toca `properties` salvo el trigger de auditoría                                                                                                |

### `property_price_history` — detalle

```sql
create table public.property_price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  previous_price numeric(14,2),
  new_price numeric(14,2),
  currency text check (currency is null or currency in ('ARS','USD')),
  change_reason text,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now()
);
```

Regla del spec ("no depender de que el frontend recuerde crear el
historial"): se implementa con un **trigger** `AFTER UPDATE ON
properties FOR EACH ROW WHEN (OLD.price IS DISTINCT FROM NEW.price)` que
inserta la fila automáticamente — mismo patrón que `set_updated_at()` ya
usado en toda la base. Así cualquier camino de escritura futuro (import
masivo, otra pantalla) queda cubierto sin que nadie tenga que acordarse.
No duplica eventos porque solo dispara cuando el valor realmente cambia
(`IS DISTINCT FROM`, no un `UPDATE` que reescribe el mismo valor).

**Migraciones Bloque C:** 1 (tabla + trigger + RLS `organization_id in (select private.user_org_ids())`, mismo patrón que toda tabla de negocio desde Fase 1).
**Archivos afectados:** `app/(dashboard)/properties/[id]/page.tsx` (reestructura a tabs), nuevo `lib/data/property-price-history.ts`, nuevo `components/properties/price-history.tsx`.
**Riesgo de regresión:** medio, concentrado en la reestructura a tabs (ver arriba) — no en la parte de datos.

---

## Bloque D — Visitas (feedback) ✅ implementado

Implementado tal como se planeó, con la tab "Visitas" agregada a la
ficha de propiedad (Bloque C había dejado el hueco a propósito):

- "Finalizar visita" reemplaza el botón "Completar" únicamente para
  activities `property_visit`/`acquisition_visit` en estado `scheduled`
  (`app/(dashboard)/calendar/page.tsx` — el resto de los tipos de evento
  siguen usando `updateEventStatus` sin cambios). Abre
  `components/ui/dialog.tsx` — primer uso real de ese componente (antes
  solo lo usaban internamente el sidebar/command palette).
- `finalizeVisit` (`app/(dashboard)/calendar/actions.ts`) hace las tres
  cosas en un solo paso — completar la activity, guardar el feedback
  (`upsert` por `activity_id`, así reabrir el diálogo sobre una visita ya
  finalizada edita en vez de duplicar), y crear la task de seguimiento
  opcional con el mismo contexto (contact/property/etc.) que la visita —
  nunca un sistema de tareas paralelo.
- "Visitas" visible desde la ficha de propiedad (tab nueva, con contenido
  real esta vez) y desde la ficha de cliente (card nueva) —
  `lib/data/visit-feedback.ts` resuelve ambas direcciones con el mismo
  patrón de 2 consultas + Map que el resto de `lib/data/*` (no un embed de
  PostgREST, que nada más en este proyecto usa).
- Migración: `visit_feedback`, `unique (activity_id)`, RLS estándar (a
  diferencia de `property_price_history`, esta sí la escribe la app
  directamente — no hace falta un trigger, el evento que la dispara es
  una acción explícita del asesor, no un cambio de columna que hay que
  interceptar).
- Verificado end-to-end contra Supabase real: finalizar una visita
  agendada guarda el feedback completo (nivel de interés, ambas
  percepciones, comentarios) Y crea la task de seguimiento con
  contact_id + property_id correctos en un solo submit; la activity pasa
  a "Realizado"; el feedback aparece tanto en la tab Visitas de la
  propiedad como en la card Visitas del cliente, y la "próxima acción" /
  "última interacción" del cliente reflejan la visita y la task nuevas.
  Sin errores de consola ni de servidor.

Detalle original del plan:

| Mejora                                                                                  | Estado actual                                                                                                                          | Reutilizar                                           | Modificar                                                                                                                       | Nuevo                                            | Riesgo               |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------- |
| Modelo de visita                                                                        | `activities` con `type in ('property_visit','acquisition_visit')` ya representa el evento (Fase 1/8/9, sincroniza con Google Calendar) | `activities`, `updateEventStatus` (Fase 8)           | Ninguno — el spec pide explícitamente no crear `visits` si `activities` ya alcanza, y alcanza                                   | —                                                | Ninguno              |
| "Finalizar visita"                                                                      | Hoy `updateEventStatus` marca `completed`/`cancelled` desde `/calendar` (botones rápidos) pero no abre ningún formulario de feedback   | `updateEventStatus`                                  | Cuando se finaliza una activity de tipo visita, ofrecer el formulario de feedback (no bloquear si el usuario prefiere saltarlo) | —                                                | Bajo                 |
| Feedback (interés, gustó/no gustó, percepción de precio, quiere avanzar, observaciones) | No existe estructura — confirmado que no hay campos equivalentes ni en `activities` ni en `notes`                                      | —                                                    | —                                                                                                                               | `visit_feedback` (1:1 opcional con `activities`) | Bajo — tabla aditiva |
| Próxima acción desde el feedback                                                        | `createTask` ya existe y acepta cualquier combinación de contexto (`contactId`/`propertyId`/`searchId`)                                | `createTask` (`lib/actions/engagement.ts`)           | Ninguno — se llama igual, solo se ofrece en el mismo modal que el feedback                                                      | —                                                | Ninguno              |
| Ver feedback desde propiedad y desde cliente                                            | —                                                                                                                                      | `getActivities` ya trae por `contactId`/`propertyId` | Extender esas queries (o una nueva `getVisitFeedback`) para incluir el feedback vinculado                                       | —                                                | Bajo                 |

### `visit_feedback` — detalle

```sql
create table public.visit_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  interest_level text check (interest_level in ('very_interested','interested','unsure','discarded')),
  positive_feedback text,
  negative_feedback text,
  price_perception text check (price_perception in ('low','fair','high')),
  wants_to_proceed text check (wants_to_proceed in ('yes','no','thinking')),
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id)
);
```

`unique (activity_id)` en vez de una FK 1:1 más elaborada — una visita
tiene a lo sumo un feedback, y así un `upsert` simple alcanza para
"cargar o editar" sin lógica extra.

**Migraciones Bloque D:** 1 (tabla + RLS).
**Archivos afectados:** `app/(dashboard)/calendar/page.tsx` (o el componente de fila de evento), nuevo `lib/data/visit-feedback.ts`, nuevo `components/activities/visit-feedback-form.tsx`, ficha de propiedad y de contacto (mostrar feedback).
**Riesgo de regresión:** bajo.

---

## Bloque E — Ofertas ✅ implementado

Implementado tal como se planeó, con dos decisiones tomadas durante la
implementación:

- **Sin columna "de qué lado vino la contraoferta":** `offers.contact_id`
  se mantiene igual (la contraparte de la negociación) a lo largo de toda
  la cadena — el spec mostraba nombres distintos en su ejemplo
  ("Propietario" contraofertando), pero modelar eso hubiera pedido un
  segundo contacto por fila sin que ningún flujo real de este bloque lo
  necesite. Documentado como simplificación deliberada.
- **Formularios que devuelven `{error}`, no `<form action>` directo:**
  `acceptOfferAndCreateDeal` puede fallar (propiedad sin propietario
  cargado) y necesita mostrar ese error — así que, a diferencia de
  `createOffer` (simple, sin reporte de error, mismo criterio que
  `createTask`/`addOwner`), su botón "Aceptar" vive en
  `components/offers/offer-thread.tsx` (client) y llama la action con
  `startTransition`, mismo patrón que `convert-lead-form.tsx` — un
  `<form action>` no puede apuntar a una función que devuelve algo
  distinto de `void`.
- `acceptOfferAndCreateDeal` reutiliza el propietario principal de
  `property_owners` como `seller_contact_id` y el `operation_type` de la
  propiedad como `deal_type` — nunca le pide al asesor datos que ya están
  cargados.
- Verificado end-to-end contra Supabase real: oferta inicial → contraoferta
  (la original pasa a "Contraofertada" automáticamente, nunca se sobrescribe
  el monto) → aceptar crea una operación con comprador/vendedor/precio
  correctos y estado inicial "Oferta"; una SEGUNDA oferta aceptada sobre la
  misma propiedad se vinculó a la operación ya existente en vez de crear una
  segunda (confirmado por consulta directa: 1 sola fila en `deals`, ambas
  ofertas aceptadas apuntando al mismo `deal_id`). Sin errores de consola ni
  de servidor.

Detalle original del plan:

| Mejora                                        | Estado actual                                                                                                                                                                                                                     | Reutilizar                                                        | Modificar                                                                                                                                                                            | Nuevo                                                                                                        | Riesgo                                                                                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Separar interés → visita → oferta → operación | `deals` (Fase 6) ya modela la operación (comprador+vendedor+propiedad con pipeline propio) pero no tiene ningún concepto de "oferta preliminar" antes de que exista una operación en curso — confirmado, no hay campo equivalente | `deals`, `contacts`, `properties`                                 | Ninguno sobre `deals`                                                                                                                                                                | `offers` (nueva)                                                                                             | Bajo — aditiva, `deals` no cambia de forma                                                                                                                         |
| Estados de oferta                             | No existen                                                                                                                                                                                                                        | —                                                                 | —                                                                                                                                                                                    | Enum `pending, accepted, rejected, counter_offered, withdrawn, expired`                                      | —                                                                                                                                                                  |
| Contraofertas con historial (no sobrescribir) | No existe                                                                                                                                                                                                                         | —                                                                 | —                                                                                                                                                                                    | `offers.parent_offer_id` (self-FK nullable) — cada contraoferta es una fila nueva, nunca un update del monto | Bajo                                                                                                                                                               |
| UI de ofertas desde propiedad                 | —                                                                                                                                                                                                                                 | Card pattern ya usado en toda ficha (Card/CardHeader/CardContent) | Agregar tab/card "Ofertas" en la ficha de propiedad (Bloque C)                                                                                                                       | `components/offers/offer-list.tsx`                                                                           | Bajo                                                                                                                                                               |
| Registrar oferta (acción rápida)              | —                                                                                                                                                                                                                                 | `ContactSelectField`/`PropertySelectField` (pickers ya resueltos) | —                                                                                                                                                                                    | `createOffer` action                                                                                         | Bajo                                                                                                                                                               |
| Aceptar oferta → crear operación prellenada   | `createDeal` ya existe (Fase 6) y pide propiedad/comprador/vendedor/tipo/precio                                                                                                                                                   | `createDeal`                                                      | Extender `createDeal` (o un wrapper `createDealFromOffer`) para aceptar un `offerId` opcional y prellenar `property_id`/`buyer_contact_id`/`agreed_price`/`currency` desde la oferta | —                                                                                                            | Medio — toca el punto de entrada de `deals`; mitigar sin cambiar la firma pública de `createDeal`, solo agregando un flujo que la llama con valores precompletados |
| Vincular a deal existente si ya hay uno       | —                                                                                                                                                                                                                                 | `deals` por `property_id`                                         | Query `findOpenDealForProperty` antes de ofrecer "Crear operación"                                                                                                                   | —                                                                                                            | Bajo                                                                                                                                                               |

### `offers` — detalle

```sql
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  contact_id uuid not null references public.contacts (id),
  deal_id uuid references public.deals (id) on delete set null,
  amount numeric(14,2) not null,
  currency text not null check (currency in ('ARS','USD')),
  status text not null default 'pending' check (
    status in ('pending','accepted','rejected','counter_offered','withdrawn','expired')
  ),
  conditions text,
  expiration_date date,
  parent_offer_id uuid references public.offers (id) on delete set null,
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Migraciones Bloque E:** 1 (tabla `offers` + RLS + índices `property_id`, `deal_id`, `status`).
**Archivos afectados:** nuevo `lib/data/offers.ts`, `lib/validations/offer.ts`, `app/(dashboard)/offers/actions.ts` (o dentro de `properties/actions.ts` si se prefiere no crear una sección de nav nueva — a decidir en la implementación, por defecto sin nueva entrada de nav: las ofertas se ven desde la ficha de propiedad/cliente, no como listado propio), ficha de propiedad (Bloque C), `app/(dashboard)/deals/actions.ts` (`createDeal` extendido).
**Riesgo de regresión:** medio, concentrado en el enganche con `createDeal` — se mitiga sin tocar su contrato actual.

---

## Bloque F — Ficha de cliente ✅ implementado

Implementado tal como se planeó, sin migración. Único agregado no
anticipado: extraje `formatBudget` (antes una función local de
`app/(dashboard)/searches/[id]/page.tsx`) a `lib/format.ts` para que la
ficha de cliente use exactamente el mismo formato de presupuesto en vez
de una segunda copia — verificado que `/searches/[id]` sigue mostrando
igual después del refactor (regresión, no bloque F en sí).

- `listSearchesByContact` pasó de 7 a 13 columnas — ahora trae
  `cities`/`neighborhoods`/`min_bedrooms`/`objective`/`urgency` además de
  lo que ya traía, todo en la misma consulta.
- Cada búsqueda en la ficha de cliente muestra tipo, estado, operación,
  zona, dormitorios mínimos, presupuesto, objetivo y urgencia — sin
  fabricar datos: una búsqueda con menos campos cargados simplemente
  muestra menos, nunca "—" de relleno.
- Header con accesos directos "+ Tarea" (ancla a la card de Tareas,
  mismo patrón que el banner de captación rápida de Bloque B) y
  "+ Agendar" (reutiliza `/calendar/new?contactId=`, ya existente).
- Verificado end-to-end contra Supabase real: un contacto con dos
  búsquedas (una completa — zona/dormitorios/presupuesto/objetivo/
  urgencia — y otra mínima) mostró cada una con exactamente los campos
  que tenía cargados; "+ Tarea" apunta a `#tareas` correctamente. Sin
  errores de consola ni de servidor.

Detalle original del plan:

| Mejora                                      | Estado actual                                                                                                      | Reutilizar                                                                 | Modificar                                                                                                           | Nuevo | Riesgo  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----- | ------- |
| Header con roles + acciones rápidas         | Ya existe (`app/(dashboard)/contacts/[id]/page.tsx`) con teléfono/WhatsApp/email/roles                             | Todo                                                                       | Agregar accesos "Tarea"/"Agendar" directos en el header (hoy están más abajo, en sus propias Cards)                 | —     | Bajo    |
| Necesidad activa visible sin cambiar de tab | Existe una lista de búsquedas, pero solo muestra tipo + estado — no zona/presupuesto/dormitorios/objetivo/urgencia | `property_searches` (todos los campos ya existen), `listSearchesByContact` | Ampliar `listSearchesByContad` (seleccionar más columnas) y el render para mostrar el resumen completo por búsqueda | —     | Bajo    |
| Múltiples búsquedas mostradas por separado  | Ya lo hace (itera `searches.map`)                                                                                  | Sí                                                                         | Ninguno estructural, solo enriquecer cada item                                                                      | —     | Ninguno |
| Último contacto / próxima acción destacados | Ya existen como card propia                                                                                        | Sí                                                                         | Ninguno                                                                                                             | —     | Ninguno |

**Migraciones Bloque F:** ninguna.
**Archivos afectados:** `lib/data/searches.ts` (`listSearchesByContact`), `app/(dashboard)/contacts/[id]/page.tsx`.
**Riesgo de regresión:** bajo.

---

## Bloque G — Matching ✅ implementado

Implementado tal como se planeó, sin tocar ningún archivo de la Fase 11
(`lib/matching/score.ts`/`lib/data/matching.ts` quedaron intactos) —
"Registrar envío" se agregó al lado de cada match, en las páginas, no
adentro de esa lógica.

- Nueva tab "Interesados" en la ficha de propiedad (junto a "Visitas" y
  "Ofertas" de los Bloques D/E) con el historial de envíos y control de
  estado (enviada/interesado/no interesado/visita agendada).
- Nueva card "Propiedades presentadas" en la ficha de cliente.
- `createRecommendation`/`updateRecommendationStatus` viven en
  `lib/actions/recommendations.ts` (no en `app/(dashboard)/properties/`
  ni `.../searches/`) porque ambas rutas las necesitan por igual — mismo
  criterio que `lib/actions/engagement.ts`.
- **Bug real encontrado y corregido (código de este mismo bloque):**
  actualizar el estado de un envío disparaba el warning de Base UI "a
  component is changing the default value state of an uncontrolled
  Select after being initialized" — exactamente el mismo gotcha ya
  documentado en la Fase 6 (un formulario que revalida en el lugar, sin
  redirect, con un control cuyo valor por defecto cambia bajo un mismo
  montaje), esta vez sobre un `Select` en vez de un `Input`. Mismo fix:
  `key={r.updated_at}` en el `<form>` para forzar un remount limpio —
  agregado `updated_at` a la consulta de `lib/data/recommendations.ts`
  para tenerlo disponible.
- Verificado end-to-end contra Supabase real: "Registrar envío" desde
  Coincidencias en ambas direcciones (propiedad→búsquedas y
  búsqueda→propiedades) crea el registro correcto; la tab Interesados y
  la card de cliente lo muestran; tres cambios de estado consecutivos
  (enviada → interesado → visita agendada → no interesado) sin volver a
  disparar el warning de Select después del fix. Sin errores de
  servidor.

Detalle original del plan:

**Ya implementado en Fase 11** (`lib/matching/score.ts`, `lib/data/matching.ts`,
tabs "Coincidencias" en `/searches/[id]` y `/properties/[id]`) con score
0-100 determinístico, filtros duros por `operation_type`/`property_types`,
y ponderación por presupuesto/ubicación/ambientes/superficie/cochera.

| Mejora del spec                                              | Ya cubierto por Fase 11                                                       | Falta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Score 0-100 determinístico                                   | Sí                                                                            | La ponderación del spec (Operación 20, Tipo 20, Presupuesto 20, Ubicación 15, Dormitorios 10, Características 10, Superficie 5) difiere de la actual (Presupuesto 35, Ubicación 25, Ambientes 20, Superficie 10, Cochera 10) — **decisión**: mantener la ponderación actual, ya implementada, verificada en vivo y documentada (docs/DATABASE.md Fase 11), en vez de reajustarla sin un motivo funcional nuevo. Reajustar pesos sin caso de uso que lo pida es el tipo de cambio que esta V2 pide evitar ("no introducir una abstracción nueva" sin necesidad real). Si en el uso real los pesos no sirven, se ajustan como refinamiento puntual, no como reescritura. |
| Filtros duros (operación incompatible = score bajo/excluido) | Sí — se excluye directamente, más estricto que "penalizar"                    | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Matching desde propiedad → clientes                          | Sí (`getSearchMatchesForProperty`)                                            | Acciones rápidas "Registrar envío"/"Agendar seguimiento"/"WhatsApp" junto al resultado — hoy solo hay link a la búsqueda. Se agregan cuando exista `property_recommendations` (mismo bloque, ver abajo) para que "Registrar envío" tenga a dónde escribir                                                                                                                                                                                                                                                                                                                                                                                                              |
| Matching desde búsqueda → propiedades con razones            | Sí (`getPropertyMatchesForSearch` + `summarizeCriteria`)                      | Ya muestra razones (✓/~/✗ por criterio) — cumple el espíritu del spec aunque el formato difiera del ejemplo literal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Propiedades presentadas (distinto de "match")                | No existe — confirmado, matching es 100% calculado al vuelo, nada se persiste | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `property_recommendations` (nueva) |

### `property_recommendations` — detalle

```sql
create table public.property_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  search_id uuid not null references public.property_searches (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  sent_at timestamptz not null default now(),
  channel text not null default 'whatsapp' check (channel in ('whatsapp','email','in_person','other')),
  status text not null default 'sent' check (status in ('sent','interested','not_interested','visit_scheduled')),
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Sin `viewed` (el spec lo pide explícitamente solo si hay tracking real —
no lo hay).

**Migraciones Bloque G:** 1 (tabla `property_recommendations` + RLS).
**Archivos afectados:** `lib/data/matching.ts` (agregar botón/acción "Registrar envío" a cada match), nuevo `lib/data/recommendations.ts`, ficha de propiedad (tab Interesados) y ficha de cliente (Bloque F).
**Riesgo de regresión:** bajo — Fase 11 no se toca, solo se le agrega una acción de escritura opcional al lado.

---

## Bloque H — Refinamiento (leads, operaciones, dashboard, mobile)

| Mejora                                                                                      | Estado actual                                                                                                                                  | Reutilizar                       | Modificar                                                                                                                                                                       | Nuevo | Riesgo                              |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------- |
| Leads como inbox comercial (canal, tiempo, propiedad, mensaje, estado)                      | `/leads` ya tiene la mayoría (Fase 5) — falta "tiempo desde ingreso" en formato relativo ("hace 18 min")                                       | `leads`, `lead_overview`         | Agregar formato relativo (nuevo helper `formatRelativeTime` en `lib/format.ts`, respetando `BUSINESS_TIMEZONE`)                                                                 | —     | Bajo                                |
| Deduplicación por phone/email/dni (no por nombre)                                           | `findPossibleDuplicates` (Fase 1) ya busca por esos 3 campos, ya se usa en conversión de leads y en captación                                  | Sí, tal cual                     | Ninguno                                                                                                                                                                         | —     | Ninguno                             |
| Operaciones: etapa/precio/comprador/vendedor/propiedad/próximo hito/próxima acción visibles | `/deals/[id]` ya muestra todo salvo "próximo hito" como concepto separado de "próxima acción" (hoy son la misma task)                          | `deal_overview`, `getTasks`      | Distinguir visualmente "próximo hito" (evento agendado, `activities` scheduled) de "próxima acción" (task) en el header de la ficha                                             | —     | Bajo                                |
| Timeline sin perder historial al cambiar status                                             | `buildTimeline` ya es append-only (notes+activities+tasks), cambiar `deals.status` no borra nada                                               | Sí                               | Ninguno                                                                                                                                                                         | —     | Ninguno                             |
| Google Calendar con nuevos tipos de actividad                                               | Ya sincroniza cualquier `ActivityType` sin distinción (Fase 9) — visita/tasación/escribanía/seguimiento ya son valores válidos del enum actual | Sí, tal cual                     | Ninguno — se verifica en vivo al tocar Bloque D, no se toca `lib/google/*`                                                                                                      | —     | Ninguno                             |
| Dashboard con KPIs comerciales                                                              | Fase 10 ya tiene leads/visitas/cierres+comisión + 3 embudos                                                                                    | Todo                             | Agregar KPIs que el spec pide y no están: leads respondidos, tasaciones, propiedades captadas, reservas (derivables de tablas ya filtradas por fecha, mismo patrón que Fase 10) | —     | Bajo                                |
| Mobile: flujos críticos                                                                     | No auditado todavía en detalle — Tailwind ya usa breakpoints (`md:`, `xl:`) en toda la UI existente                                            | Grid/flex responsive ya presente | Auditar puntualmente Today/ficha cliente/ficha propiedad en viewport mobile (375px) y ajustar orden de la información (spec 79) sin rehacer el layout                           | —     | Bajo — es reordenar, no reconstruir |

**Migraciones Bloque H:** ninguna (todo es lectura nueva sobre datos ya existentes, mismo patrón que Fase 10).
**Riesgo de regresión:** bajo.

---

## Resumen de migraciones nuevas (en orden)

1. Bloque B: `create or replace view acquisition_overview` (+ `last_interaction_at`, `pending_tasks_count`).
2. Bloque C: `property_price_history` (tabla + trigger + RLS).
3. Bloque D: `visit_feedback` (tabla + RLS).
4. Bloque E: `offers` (tabla + RLS).
5. Bloque G: `property_recommendations` (tabla + RLS).

Ninguna migración borra, renombra ni cambia el tipo de una columna
existente. Todas son aditivas (`create table` o `create or replace
view` agregando columnas). Cero impacto en datos/IDs actuales.

## Riesgos de regresión — resumen global

| Riesgo                                                                             | Bloque | Mitigación                                                                                                  |
| ---------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Reestructurar la ficha de propiedad a tabs rompe algo que ya funciona              | C      | Migrar Card por Card sin tocar su lógica interna; verificar cada tab en vivo antes de seguir a la siguiente |
| El formulario de captación rápida crea un segundo camino de escritura              | B      | Reutilizar el mismo `createAcquisition`/`findPossibleDuplicates`, nunca duplicar la lógica de alta          |
| Extender `createDeal` para prellenar desde una oferta rompe el flujo manual actual | E      | No cambiar la firma pública; agregar un wrapper opcional                                                    |
| Vistas (`acquisition_overview`) usadas por más de una pantalla                     | B      | `create or replace view` solo agrega columnas — cualquier `select *` existente sigue funcionando igual      |

## Commits previstos (uno por bloque, igual que Fases 0-12)

```
feat: v2 bloque a - hoy como centro operativo
feat: v2 bloque b - captacion rapida y tabla/pipeline enriquecidos
feat: v2 bloque c - ficha de propiedad con tabs e historial de precios
feat: v2 bloque d - feedback de visitas
feat: v2 bloque e - ofertas y contraofertas
feat: v2 bloque f - ficha de cliente refinada
feat: v2 bloque g - registro de propiedades presentadas (matching)
feat: v2 bloque h - refinamiento leads/operaciones/dashboard/mobile
```

Cada uno sigue el mismo ciclo ya probado en Fases 0-12: implementación →
`typecheck`/`lint`/`build`/`format` → migración aplicada por el usuario
(`npx supabase db push`) cuando corresponda → verificación en vivo contra
Supabase real (Claude Browser) → limpieza de datos de prueba → doc
update (`ROADMAP.md`/`DATABASE.md`/`ARCHITECTURE.md`) → commit → reporte
→ confirmación para el siguiente bloque.

## Fuera de alcance de esta V2 (explícito, spec §101)

MLS, publicación automática en portales, sitio web propio, facturación,
firma digital, generación legal de contratos, IA jurídica/tasación con
IA, app nativa, WhatsApp Business API oficial (se mantiene `wa.me`),
email marketing, automatizaciones empresariales complejas, IA de
parseo de texto libre (§98, arquitectura queda compatible pero no se
construye ahora).
