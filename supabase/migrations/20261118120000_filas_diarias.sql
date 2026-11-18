-- Ellos: totais diários por canal e área (Análises Clínicas / Diagnóstico por Imagem), tempo médio de espera (TME) e abandono.
-- Gravada só pela sincronização com a Escallo (chave de serviço). Sem telefone, sem nome e sem protocolo: só contagens e somas.
--   Ligação (rel001, uma linha por chamada): área pela fila; atendidas, abandonadas e soma da espera das atendidas.
--   WhatsApp (rel091, por hora): uma linha 'total' (a Escallo não tem fila de Análises no WhatsApp): atendimentos e soma da espera (TMEAT x atendimentos).
create table public.queue_daily (
  id bigint generated always as identity primary key,
  date date not null,
  channel text not null check (channel in ('Ligação', 'WhatsApp')),
  area text not null check (area in ('analises', 'imagem', 'outros', 'total')),
  answered integer not null default 0 check (answered >= 0),
  abandoned integer not null default 0 check (abandoned >= 0),
  wait_seconds_total numeric not null default 0 check (wait_seconds_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, channel, area)
);
create index queue_daily_date_idx on public.queue_daily (date);

create trigger queue_daily_updated_at before update on public.queue_daily for each row execute function public.set_updated_at();

alter table public.queue_daily enable row level security;
-- A equipe lê. Ninguém grava pelo app: só a função da sincronização (chave de serviço ignora a RLS).
create policy "equipe lê" on public.queue_daily as permissive for select to authenticated using (( select is_member() as is_member));
