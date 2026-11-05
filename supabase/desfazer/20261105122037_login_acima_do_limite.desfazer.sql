-- DESFAZER da migração 20261105122037_login_acima_do_limite.sql (fora de supabase/migrations de propósito).
-- Apaga a tabela de alertas (e os alertas que houver nela) e volta a regra antiga de métricas aceitas.
-- ATENÇÃO: antes de rodar, apague (ou troque) qualquer linha de productivity_limits com metric = 'login_max_hours',
-- senão o banco recusa a regra antiga.

drop table if exists public.login_alerts;
drop function if exists public.login_alerts_track_status();

delete from public.productivity_limits where metric = 'login_max_hours';
alter table public.productivity_limits drop constraint productivity_limits_metric_check;
alter table public.productivity_limits add constraint productivity_limits_metric_check
  check (metric = any (array['pause_unproductive_percent', 'pause_percent', 'occupancy_min']));
