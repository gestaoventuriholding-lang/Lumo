-- Ellos: auto-atendimento do robô por dia (rel097 da Escallo, WhatsApp): contatos, resolvidos sem atendente, atendidos por pessoa, sem êxito e com erro.
-- Gravada só pela sincronização com a Escallo (chave de serviço). Só contagens: sem telefone, sem nome e sem protocolo.
create table public.auto_atendimento_diario (
  id bigint generated always as identity primary key,
  date date not null unique,
  contacts integer not null default 0 check (contacts >= 0),
  self_served integer not null default 0 check (self_served >= 0),
  served integer not null default 0 check (served >= 0),
  no_success integer not null default 0 check (no_success >= 0),
  errors integer not null default 0 check (errors >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger auto_atendimento_diario_updated_at before update on public.auto_atendimento_diario for each row execute function public.set_updated_at();

alter table public.auto_atendimento_diario enable row level security;
-- A equipe lê. Ninguém grava pelo app: só a função da sincronização (chave de serviço ignora a RLS).
create policy "equipe lê" on public.auto_atendimento_diario as permissive for select to authenticated using (( select is_member() as is_member));
