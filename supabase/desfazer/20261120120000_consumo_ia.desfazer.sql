-- Desfaz 20261120120000_consumo_ia.sql (não é migração: rodar à mão, só se for preciso voltar).
-- Apaga a tabela e os totais de consumo guardados (dá para recarregar da Escallo com o script de carga).
drop table if exists public.ia_consumo_diario;
