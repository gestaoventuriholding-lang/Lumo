-- Ellos: registro de ocorrências (reclamações, erros de agendamento e agendamentos incorretos).
-- O protocolo do atendimento é o elo com a Escallo. Não guardamos nome nem CPF do paciente (LGPD).

create table public.incidents (
  id bigint primary key,  -- gerado pelo app (newId), como nas outras tabelas
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('complaint', 'scheduling_error', 'incorrect_scheduling')),
  occurred_on date not null,
  channel text not null check (channel in ('Ligação', 'WhatsApp')),
  attendant_id bigint references public.attendants (id) on delete set null,
  attendant_name text not null default '',  -- cópia do nome: o histórico sobrevive se a pessoa for excluída
  protocol text not null check (length(btrim(protocol)) between 1 and 60),
  description text not null check (length(btrim(description)) between 1 and 600),
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  action_taken text not null default '',
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- para resolver, é preciso dizer qual foi a ação tomada
  check (status <> 'resolved' or length(btrim(action_taken)) > 0)
);

create index incidents_occurred_on_idx on public.incidents (occurred_on desc);
create index incidents_status_idx on public.incidents (status);
create index incidents_attendant_idx on public.incidents (attendant_id);
create index incidents_protocol_idx on public.incidents (protocol);

create trigger incidents_updated_at before update on public.incidents
  for each row execute function public.set_updated_at();

alter table public.incidents enable row level security;
revoke all on public.incidents from anon;
create policy "equipe acessa tudo" on public.incidents
  for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
