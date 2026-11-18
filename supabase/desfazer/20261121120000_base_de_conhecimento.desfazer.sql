-- Desfaz 20261121120000_base_de_conhecimento.sql (não é migração: rodar à mão, só se for preciso voltar).
-- ATENÇÃO: apaga todos os conhecimentos cadastrados. Faça uma cópia antes (create table backup_fase_b.knowledge_articles_copia as table public.knowledge_articles).
drop table if exists public.knowledge_articles;
