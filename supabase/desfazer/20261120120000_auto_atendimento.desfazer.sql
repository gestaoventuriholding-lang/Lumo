-- Desfaz 20261120120000_auto_atendimento.sql (não é migração: rodar à mão, só se for preciso voltar).
-- Apaga a tabela e os totais de auto-atendimento guardados (dá para recarregar da Escallo com o script de carga).
drop table if exists public.auto_atendimento_diario;
