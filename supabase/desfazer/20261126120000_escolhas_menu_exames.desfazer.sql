-- Desfaz 20261126120000_escolhas_menu_exames.sql (não é migração: rodar à mão, só se for preciso voltar).
-- Apaga a tabela e as contagens guardadas (dá para recarregar da Escallo).
drop table if exists public.exam_choices_daily;
