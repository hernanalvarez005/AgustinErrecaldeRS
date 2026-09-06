-- V2 bloque B (Captaciones): trae acquisition_overview a la par de
-- search_overview/deal_overview, que ya calculaban last_interaction_at
-- desde que existen (Fase 4/6) — acquisition_overview (Fase 6, migración
-- de corrección de next_action_at) se quedó sin ese campo. `create or
-- replace view` es aditivo: agrega columnas, no rompe ningún `select *`
-- ni ninguna columna que ya se estuviera leyendo.
--
-- pending_tasks_count es nuevo en las 4 vistas *_overview: cuántas tareas
-- abiertas (no completadas/canceladas) tiene la captación — la tabla de
-- /acquisitions lo muestra como "Pendientes" (docs/V2_EVOLUTION_PLAN.md).
create or replace view public.acquisition_overview
  with (security_invoker = true) as
select
  a.*,
  (
    select min(t.due_at)
    from public.tasks t
    where t.acquisition_id = a.id and t.status <> 'completed'
  ) as next_action_at,
  (
    select max(act.starts_at)
    from public.activities act
    where act.acquisition_id = a.id and act.status = 'completed'
  ) as last_interaction_at,
  (
    select count(*)
    from public.tasks t
    where t.acquisition_id = a.id and t.status in ('pending', 'in_progress')
  ) as pending_tasks_count
from public.property_acquisitions a;

comment on view public.acquisition_overview is
  'Read model for the acquisitions list/kanban: next_action_at + last_interaction_at + pending_tasks_count precomputed in one query, same pattern as search_overview/deal_overview. security_invoker so RLS still applies.';
