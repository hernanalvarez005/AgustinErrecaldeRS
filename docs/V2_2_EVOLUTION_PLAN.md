# V2.2 — Plan de evolución: Comunicación, archivos y sincronización de agenda

Auditoría del sistema actual antes de implementar, siguiendo el mismo
criterio `REUTILIZAR > EXTENDER > REFINAR > REFACTORIZAR > RECONSTRUIR`
de V2 y V2.1. Los 9 Bloques se implementan uno por vez, con el mismo ritmo
de verificación en vivo + build gate + commit usado en V2/V2.1.

## 1. WhatsApp — estado actual

**Ya existe** (de la Fase 5/V2 bloque A y V2.1 bloque UI-4):

- `lib/phone.ts`: `toWhatsAppLink(phone)` — genera `https://wa.me/<dígitos>`
  quitando todo lo que no sea dígito. **No** maneja el caso argentino del
  "9" (ver abajo), no acepta mensaje prellenado, y no valida nada.
- Botón "WhatsApp" ya visible en el header de `/contacts/[id]` (desktop,
  V2.1 bloque UI-4) usando `contact.whatsapp || contact.phone`.
- `lib/data/today.ts` ya arma un `whatsappHref` para las tareas de Hoy
  ligadas a un contacto.

**Gap real (el motivo de este Bloque):** el número argentino de WhatsApp
necesita el dígito `9` después del `54` para que `wa.me` abra el chat
correctamente (`+54 11 1234-5678` → `5491112345678`, no `541112345678`) —
`toWhatsAppLink` no lo hace hoy. Tampoco hay mensaje prellenado, ni estado
deshabilitado con aviso cuando el contacto no tiene teléfono.

**Plan:** extender `lib/phone.ts` (normalización real + mensaje opcional),
ajustar el botón para deshabilitarse con aviso cuando no hay teléfono. No
se toca el dato guardado en `contacts.phone`/`contacts.whatsapp` — la
normalización es solo para construir la URL, nunca se escribe de vuelta.

## 2. Storage / Attachments — estado actual

**No existe nada:** sin buckets de Storage (`grep` sobre
`supabase/migrations/` sin resultados), sin tabla `attachments` ni
equivalente. Blanco completo.

**Plan:** tabla genérica `attachments` (spec punto 7) con
`entity_type`/`entity_id` en vez de FKs explícitas por entidad — con solo
dos entidades hoy (contacto, propiedad) una FK explícita nullable +
constraint sería más simple, pero `entity_type`/`entity_id` es la opción
que la spec prioriza y deja la puerta abierta a "documentos de una
operación" más adelante sin otra migración. Un bucket privado nuevo
(`attachments`), signed URLs de corta duración para ver/descargar — nunca
URLs públicas permanentes. RLS por `organization_id`, mismo patrón que
toda tabla de negocio desde la Fase 0.

## 3-4. Archivos en ficha cliente/propiedad — estado actual

No existen. Se construyen sobre la tabla `attachments` del Bloque 2 y los
tabs ya establecidos en V2.1 (`Tabs`/`TabsContent`, mismo patrón que
Interesados/Visitas/Ofertas/Actividad en propiedad).

## 5. Google Calendar — auditoría (spec pide documentar antes de tocar nada)

**Flujo actual confirmado: estrictamente unidireccional CRM → Google.**

- `lib/google/calendar.ts`: `createGoogleCalendarEvent`/
  `updateGoogleCalendarEvent`/`deleteGoogleCalendarEvent` — las tres llaman
  a la Calendar API v3 en nombre del usuario conectado. Todas
  "best-effort": si Google falla, el registro CRM se guarda igual (el CRM
  es la fuente de verdad, comentario explícito en el código).
- `app/(dashboard)/calendar/actions.ts` ya invoca estas tres funciones al
  crear/editar/cancelar una `activity` — confirmado que el lado
  "CRM → Google" pedido en el punto 24 de la spec **ya funciona**, no hay
  que construirlo.
- **No existe ningún camino Google → CRM.** Sin `nextSyncToken`/`syncToken`
  guardado en ningún lado, sin webhook, sin concepto de "evento externo",
  sin cron/endpoint que llame a Google para traer cambios.
- `google_calendar_connections` es **por usuario** (`user_id`, sin
  `organization_id`) — consistente con que la conexión OAuth es personal
  (la cuenta de Google de Agustín), no de la organización. Se mantiene así.
- Configuración (`/settings`) hoy solo tiene "Conectado como
  {email}" + botón Desconectar — sin "Sincronizar ahora" ni "Última
  sincronización" (puntos 30-31 de la spec, no existen todavía).
- `activities.google_event_id` ya existe y ya se usa para vincular una
  activity CRM con su evento de Google — pieza clave para deduplicar en
  la sincronización entrante sin agregar columnas nuevas.

**Plan:** Bloques 6-9 construyen el camino Google → CRM sobre esta base
existente, sin tocar el camino CRM → Google que ya funciona. Ver el plan
detallado por Bloque más abajo.

## Plan por Bloque

| Bloque | Alcance                              | REUTILIZAR                                                                                  | CREAR                                                                         |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1      | WhatsApp directo                     | `toWhatsAppLink`, botón ya existente en header                                              | Normalización AR + mensaje opcional + estado deshabilitado                    |
| 2      | Storage + `attachments`              | RLS/`organization_id` (mismo patrón de siempre)                                             | Migración `attachments`, bucket privado, helpers de signed URL                |
| 3      | Archivos en ficha cliente            | Patrón de tabs/cards de V2.1                                                                | Tab/sección "Archivos" en `/contacts/[id]`                                    |
| 4      | Archivos en ficha propiedad          | Tabs ya existentes (Resumen/Interesados/...)                                                | Tab "Documentación" en `/properties/[id]`                                     |
| 5      | Auditoría Calendar                   | — (ya completada arriba)                                                                    | Esta sección del documento                                                    |
| 6      | Google → CRM incremental sync        | `google_event_id`, `google_calendar_connections`, patrón "external" ya sugerido por la spec | Columna(s) de sync token, concepto de evento externo, endpoint/acción de sync |
| 7      | Push/webhook                         | Endpoint HTTPS ya disponible (Vercel)                                                       | Canal de notificaciones, renovación, validación                               |
| 8      | UI de eventos externos + vinculación | `/calendar`, `/today` ya muestran activities                                                | Indicador "Google Calendar", flujo de vincular/convertir                      |
| 9      | QA + mobile + seguridad              | Metodología de testing ya usada en V1/V2/V2.1                                               | Checklist final de este documento                                             |

Cada Bloque sigue el mismo ritmo ya usado en V2/V2.1: implementar →
`npx next typegen` (si cambian rutas) → `npm run typecheck` → `npm run lint`
→ `npm run build` → `npm run format` → migraciones aplicadas por el usuario
(`npx supabase db push`) → verificación en vivo contra el proyecto Supabase
hosteado real vía Claude Browser → limpieza de datos de prueba → commit →
push → reporte → confirmación para el siguiente Bloque.

## Estado de avance

- **Bloque 1 (WhatsApp directo)** — ✅ completo. `lib/phone.ts`, botón en
  `/contacts/[id]`. Commit `cef79a1`.
- **Bloque 2 (Storage + `attachments`)** — ✅ completo. Migración
  `20260907150000_attachments.sql` (tabla `attachments` con FKs explícitas
  `contact_id`/`property_id` nullable + CHECK "exactamente una entidad",
  bucket privado `attachments`, RLS por `organization_id` en tabla y
  Storage), `lib/validations/attachment.ts`, `lib/data/attachments.ts`,
  `lib/actions/attachments.ts` (create/rename/delete/signed URL).
  Verificado en vivo: aislamiento cross-organización confirmado en los tres
  vectores (SELECT de tabla, `createSignedUrl`, INSERT a Storage) — un
  usuario de la organización A recibe "no encontrado"/"RLS policy" al
  intentar leer o escribir un archivo real de la organización B, aun
  cuando el objeto sí existe en Storage.
- **Bloques 3-4 (Archivos en ficha cliente/propiedad)** — ✅ completos.
  `components/attachments/` (`attachment-upload-form.tsx` con
  drag-and-drop + validación de tipo/tamaño en cliente + limpieza de
  huérfanos en Storage si falla el insert de metadata,
  `attachment-list.tsx` con Ver/Descargar/Renombrar/Eliminar,
  `attachments-section.tsx` combinando ambos). Montado como sección
  "Archivos" en `/contacts/[id]` y como tab "Documentación" en
  `/properties/[id]`. Verificado en vivo: subida, listado, ver (URL
  firmada 120s), descargar (`Content-Disposition: attachment`), renombrar,
  eliminar (borra Storage y luego la fila) — y los rechazos de tipo/MIME
  no coincidente y de tamaño >15MB en el cliente.
- **Bloque 5 (Auditoría Calendar)** — ✅ completo, ver secciones 5.x
  arriba.
- **Bloque 6 (Google → CRM incremental sync)** — ✅ completo.
  `sync_token`/`last_synced_at` en `google_calendar_connections`,
  `source`/`google_updated_at` en `activities` (reutilizando las FKs de
  vinculación ya existentes — nada nuevo para "vincular", queda listo para
  el Bloque 8). `lib/google/calendar.ts` (`listChangedGoogleCalendarEvents`:
  paginación, `syncToken`/full-sync con ventana de 90 días, detección de
  token inválido) y `lib/google/calendar-sync.ts` (aplica los cambios:
  evento nuevo → fila externa sin ninguna vinculación CRM; evento
  actualizado → refresca título/horario con guard anti-reproceso por
  `google_updated_at`; evento cancelado → fila puramente externa se borra,
  fila vinculada al CRM se marca `cancelled` preservando historial).
  Botón "Sincronizar ahora" en Configuración. Indicador discreto "Google
  Calendar" en `/calendar` y `/today`; los eventos externos son de solo
  lectura (sin Completar/Cancelar/editar) hasta que el Bloque 8 agregue
  "Vincular"/"Convertir en actividad CRM". Guard en `updateEventStatus`
  que nunca borra un evento real de Google salvo que la fila sea
  `source='crm'`.

  Verificado en vivo contra la cuenta de Google real ya conectada
  (con permiso explícito del usuario, solo lectura salvo dos eventos de
  prueba descartables creados y borrados por esta misma verificación):
  36 eventos personales reales importados correctamente como filas
  externas sin crear ningún contacto/propiedad/tarea; sync repetido sin
  duplicar (idempotencia por `sync_token`); un evento de prueba puramente
  externo cancelado en Google → fila eliminada de la DB; un evento creado
  desde el CRM (`source='crm'`) cancelado en Google → fila quedó
  `cancelled`, no se borró. Todos los datos de prueba (filas `activities`,
  eventos de Google, `sync_token`) limpiados al final.

- **Bloque 8 (UI de eventos externos y vinculación)** — ✅ completo. Sin
  migración nueva — reutiliza las FKs de `activities` que ya existían.
  `LinkExternalEventDialog` (`components/calendar/link-external-event-dialog.tsx`)
  ofrece, desde cualquier evento externo en `/calendar`, "Vincular" (setea
  Cliente/Propiedad/Búsqueda/Captación/Operación + tipo, sin tocar
  `source` — sigue de solo lectura y sincronizado desde Google) y
  "Convertir en actividad CRM" (lo mismo, más `source='crm'`, con lo que
  pasa a tener los botones Completar/Cancelar y edición normales). Ninguna
  de las dos acciones toca el evento en Google — su título ahí sigue
  siendo el que escribió el asesor, y se sigue reflejando por el sync
  normal. `lib/google/calendar-sync.ts` ahora decide borrar-vs-cancelar un
  evento eliminado en Google por si está "vinculado" (`source='crm'` O
  cualquier FK seteada), no solo por `source`, para que un evento
  meramente vinculado (no convertido) tampoco pierda su relación con un
  hard-delete. Nuevas `listAcquisitionOptions`/`listSearchOptions` en
  `lib/data/` para los pickers.

  Verificado en vivo: "Vincular" un evento externo de prueba a un cliente
  → guardó la FK, mantuvo `source='google_calendar'`, el evento siguió de
  solo lectura mostrando el link resuelto y el botón pasó a "Editar
  vínculo" con el cliente preseleccionado al reabrir. "Convertir en
  actividad CRM" cambiando también el tipo → `source` pasó a `'crm'`, el
  evento ganó los botones Completar/Cancelar y el título volvió a ser
  editable, igual que cualquier actividad creada normalmente. Datos de
  prueba limpiados al final.
- **Bloques 7 y 9** — pendientes.
