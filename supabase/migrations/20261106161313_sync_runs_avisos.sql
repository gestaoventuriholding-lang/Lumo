-- Avisos da sincronização (ex.: atendimento de colaborador desligado, ignorado)
alter table public.sync_runs
  add column ignored_terminated integer not null default 0,
  add column warnings jsonb not null default '[]'::jsonb;
