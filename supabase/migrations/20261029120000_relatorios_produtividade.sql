-- Elos: relatórios de produtividade por agente (ex.: REL090)
-- Guarda, por colaborador e período, atendimentos de entrada/saída, TMA, tempo logado,
-- pausas e taxa de ocupação. Relatório por dia vira período de 1 dia (início = fim).

create table public.productivity_reports (
  id bigint primary key,  -- gerado pelo app (newId), como nas outras tabelas
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attendant_id bigint not null references public.attendants (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  channel text not null check (channel in ('Ligação', 'WhatsApp', 'E-mail', 'Outros')),
  inbound_count integer check (inbound_count >= 0),
  outbound_count integer check (outbound_count >= 0),
  attendances_count integer not null default 0 check (attendances_count >= 0),
  talk_seconds bigint check (talk_seconds >= 0),
  tma_seconds integer check (tma_seconds >= 0),
  login_seconds bigint check (login_seconds >= 0),
  pause_seconds bigint check (pause_seconds >= 0),
  pause_percent numeric(6, 2),
  pause_legal_seconds bigint check (pause_legal_seconds >= 0),
  pause_productive_seconds bigint check (pause_productive_seconds >= 0),
  pause_unproductive_seconds bigint check (pause_unproductive_seconds >= 0),
  occupancy_to1 numeric(6, 2),
  occupancy_to2 numeric(6, 2),
  occupancy_to3 numeric(6, 2),
  occupancy_to4 numeric(6, 2),
  per_hour numeric(8, 2),
  report_code text,
  source_file text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (attendant_id, period_start, period_end, channel)
);
create index productivity_reports_owner_period_idx
  on public.productivity_reports (owner_id, period_start, period_end);
create index productivity_reports_attendant_idx
  on public.productivity_reports (attendant_id);

create trigger productivity_reports_updated_at before update on public.productivity_reports
  for each row execute function public.set_updated_at();
create trigger productivity_reports_attendant_owner before insert or update on public.productivity_reports
  for each row execute function public.check_attendant_owner();

alter table public.productivity_reports enable row level security;
revoke all on public.productivity_reports from anon;
create policy "dono le" on public.productivity_reports
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria" on public.productivity_reports
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "dono altera" on public.productivity_reports
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "dono apaga" on public.productivity_reports
  for delete to authenticated using ((select auth.uid()) = owner_id);
create policy "admin acessa tudo" on public.productivity_reports
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
