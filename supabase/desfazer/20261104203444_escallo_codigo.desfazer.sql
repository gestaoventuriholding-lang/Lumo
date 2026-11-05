-- DESFAZER da migração 20261104203444_escallo_codigo.sql.
-- Fica FORA de supabase/migrations de propósito: não deve ser aplicado automaticamente.
-- Remove só o que a migração criou (índice e coluna). Nenhum outro dado do colaborador é alterado.
--
-- ATENÇÃO: se já houver códigos da Escallo preenchidos, apagar a coluna os perde.
-- Antes de rodar, guarde a lista com:
--   select id, name, escallo_codigo from public.attendants where escallo_codigo is not null;

drop index if exists public.attendants_escallo_codigo_key;
alter table public.attendants drop column if exists escallo_codigo;
