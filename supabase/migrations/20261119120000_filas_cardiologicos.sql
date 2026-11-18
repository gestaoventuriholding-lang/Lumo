-- Ellos: filas passam a seguir as 3 opções de exame da URA (laboratoriais, imagem, cardiológicos) + "outras".
-- A área 'analises' continua guardando os exames laboratoriais. Nova área: 'cardiologicos' (antes ficava dentro de 'imagem').
-- Depois de aplicar, reprocesse o histórico (script de carga) para separar cardiologia e levar Entrega de Laudos para 'outros'.
alter table public.queue_daily drop constraint queue_daily_area_check;
alter table public.queue_daily add constraint queue_daily_area_check check (area in ('analises', 'imagem', 'cardiologicos', 'outros', 'total'));
