-- Desfaz 20261127131848_follow_up_orcamentos.sql (não é migração: rodar à mão, só se for preciso voltar).
-- ATENÇÃO: apaga também o acompanhamento que a equipe preencheu. Exporte a tabela antes.
-- Os orçamentos em si dá para recarregar da Escallo; as anotações não.
drop table if exists public.quote_followups;
