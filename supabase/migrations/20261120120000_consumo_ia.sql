-- Ellos: consumo de FTokens da IA da Escallo por dia (rel103 "Extrato de consumo de modelos especializados").
-- Gravada só pela sincronização com a Escallo (chave de serviço). Só somas e contagens: sem telefone, nome nem protocolo.
--   ftokens  = soma dos FTokens das ações do dia (é o "Total de FTokens" da tela de contatos da Escallo)
--   contacts = contatos (protocolos) distintos com consumo no dia
--   actions  = ações de IA registradas no dia (linhas do extrato)
create table public.ia_consumo_diario (
  id bigint generated always as identity primary key,
  date date not null unique,
  ftokens numeric(14, 2) not null default 0 check (ftokens >= 0),
  contacts integer not null default 0 check (contacts >= 0),
  actions integer not null default 0 check (actions >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ia_consumo_diario_updated_at before update on public.ia_consumo_diario for each row execute function public.set_updated_at();

alter table public.ia_consumo_diario enable row level security;
-- A equipe lê. Ninguém grava pelo app: só a função da sincronização (chave de serviço ignora a RLS).
create policy "equipe lê" on public.ia_consumo_diario as permissive for select to authenticated using (( select is_member() as is_member));
