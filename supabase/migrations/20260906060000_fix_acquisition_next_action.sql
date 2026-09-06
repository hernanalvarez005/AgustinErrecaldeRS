-- Bug real encontrado al planificar Fase 6 (operaciones): al modelar
-- deals.next_action_at nos dimos cuenta de que property_acquisitions ya
-- tenía una columna `next_action_at timestamptz` desde la Fase 3, pero
-- nada en el código la escribía jamás — INSERT/UPDATE de
-- property_acquisitions no la tocan en ningún lado. Resultado: la columna
-- "Próxima acción" en /acquisitions (tabla y tarjetas del Kanban) mostraba
-- siempre "—" desde que existe la fase, silenciosamente.
--
-- Fix: la misma columna que ya usan contact_overview/property_overview/
-- search_overview/lead_overview — calculada por vista (`security_invoker`)
-- a partir de `tasks`, no un valor manual que nadie setea. Se elimina la
-- columna muerta y se agrega `acquisition_overview`; `lib/data/acquisitions.ts`
-- pasa a leer de la vista en vez de la tabla base (mismo nombre de columna,
-- ningún cambio en el resto de la UI).

alter table public.property_acquisitions drop column next_action_at;

create view public.acquisition_overview
  with (security_invoker = true) as
select
  a.*,
  (
    select min(t.due_at)
    from public.tasks t
    where t.acquisition_id = a.id and t.status <> 'completed'
  ) as next_action_at
from public.property_acquisitions a;
