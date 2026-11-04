-- Ellos: guarda o código do agente na Escallo no cadastro do colaborador.
-- Com ele, a integração liga cada linha do relatório da Escallo ao colaborador certo, sem depender do nome.
--
-- Só ACRESCENTA: uma coluna opcional (começa vazia em todos os colaboradores) e um índice.
-- Não altera nem apaga nenhum dado existente, e não muda regras de acesso (RLS) nem gatilhos.

alter table public.attendants add column escallo_codigo bigint;

-- Dois colaboradores não podem ter o mesmo código da Escallo. Colaboradores sem código (vazio) não entram na regra.
create unique index attendants_escallo_codigo_key
  on public.attendants (escallo_codigo)
  where escallo_codigo is not null;

comment on column public.attendants.escallo_codigo is
  'Código do agente na Escallo (campo "codigo" do relatório). Vazio = ainda não vinculado.';
