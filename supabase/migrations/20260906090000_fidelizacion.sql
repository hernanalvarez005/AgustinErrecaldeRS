-- Fase 12: Fidelización — tareas automáticas de seguimiento postventa,
-- aniversario de cierre y cumpleaños. Nunca envía un mensaje: solo crea
-- una fila en `tasks` para que el asesor decida cómo y cuándo contactar
-- (ver docs/ROADMAP.md).
--
-- `contact_roles` ya tenía 'past_client'/'referrer' desde la Fase 1 — no
-- hace falta ninguna columna nueva ahí, la automatización de esta fase
-- simplemente empieza a asignar 'past_client' cuando corresponde.
--
-- `tasks.category` es la única columna nueva: distingue las tasks que
-- genera esta automatización de las que el asesor crea a mano. Nullable
-- y sin default — las tasks manuales quedan sin categoría, como siempre.
-- Se usa para dos cosas: (1) evitar duplicados en cada corrida del cron
-- (una columna estructurada es más confiable que parsear el título), y
-- (2) poder distinguirlas en la UI si hiciera falta más adelante.
alter table public.tasks add column category text check (
  category is null or category in (
    'follow_up_postventa', 'follow_up_anniversary', 'follow_up_birthday'
  )
);

comment on column public.tasks.category is
  'Set only for tasks created by the retention cron (app/api/cron/retention-tasks) — null for everything created by hand.';

create index tasks_category_idx on public.tasks (category)
  where category is not null;
