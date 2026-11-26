-- Ellos: quantas vezes cada tipo de exame foi escolhido no menu principal do WhatsApp, por dia
-- (rel092 "Estatísticas de respostas de chat" da Escallo). Gravada só pela sincronização (chave de serviço).
-- Só contagens: sem telefone, nome nem protocolo.
create table public.exam_choices_daily (
  id bigint generated always as identity primary key,
  date date not null unique,
  imaging integer not null default 0 check (imaging >= 0),
  laboratory integer not null default 0 check (laboratory >= 0),
  cardiology integer not null default 0 check (cardiology >= 0),
  invalid integer not null default 0 check (invalid >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger exam_choices_daily_updated_at before update on public.exam_choices_daily for each row execute function public.set_updated_at();

alter table public.exam_choices_daily enable row level security;
revoke all on public.exam_choices_daily from anon;
-- A equipe lê. Ninguém grava pelo app: só a função da sincronização (chave de serviço ignora a RLS).
create policy "equipe lê" on public.exam_choices_daily as permissive for select to authenticated using (( select is_member() as is_member));
