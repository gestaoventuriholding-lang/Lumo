-- Desfaz 20261119120000_filas_cardiologicos.sql (não é migração: rodar à mão, só se for preciso voltar).
-- Antes de remover a área 'cardiologicos', soma as linhas dela em 'imagem' (como era antes), para não perder atendimentos.
-- Observação: Entrega de Laudos, que agora fica em 'outros', não volta sozinha para 'imagem'; para isso, reprocesse com a regra antiga.
insert into public.queue_daily (date, channel, area, answered, abandoned, wait_seconds_total)
select date, channel, 'imagem', answered, abandoned, wait_seconds_total from public.queue_daily where area = 'cardiologicos'
on conflict (date, channel, area) do update set
  answered = public.queue_daily.answered + excluded.answered,
  abandoned = public.queue_daily.abandoned + excluded.abandoned,
  wait_seconds_total = public.queue_daily.wait_seconds_total + excluded.wait_seconds_total;
delete from public.queue_daily where area = 'cardiologicos';
alter table public.queue_daily drop constraint queue_daily_area_check;
alter table public.queue_daily add constraint queue_daily_area_check check (area in ('analises', 'imagem', 'outros', 'total'));
