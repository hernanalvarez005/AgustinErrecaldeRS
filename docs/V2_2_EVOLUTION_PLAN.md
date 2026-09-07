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
