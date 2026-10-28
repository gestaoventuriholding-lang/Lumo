-- Lumo: esquema inicial
-- Espelha os dados que o app guardava no navegador (localStorage).
-- Cada linha pertence a um usuário (owner_id) e o RLS só deixa cada
-- usuário ver e alterar os próprios dados.

-- ---------------------------------------------------------------
-- Função comum: mantém updated_at atualizado
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Atendentes
-- ---------------------------------------------------------------
create table public.attendants (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  role text not null default 'Atendente',
  service_channel text not null check (service_channel in ('Ligação', 'WhatsApp')),
  working_hours text not null default '',
  jornada_start text not null default '',   -- "HH:MM"
  jornada_end text not null default '',     -- "HH:MM"
  observation text not null default '',
  registration_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index attendants_owner_idx on public.attendants (owner_id);

-- ---------------------------------------------------------------
-- Registros diários de desempenho
-- ---------------------------------------------------------------
create table public.performance_records (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attendant_id bigint not null references public.attendants (id) on delete cascade,
  date date not null,
  channel text not null check (channel in ('Ligação', 'WhatsApp', 'E-mail', 'Outros')),
  attendances_count integer not null default 0 check (attendances_count >= 0),
  average_time_minutes numeric(8, 2) not null default 0 check (average_time_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attendant_id, date, channel)
);
create index performance_records_owner_date_idx on public.performance_records (owner_id, date);
create index performance_records_attendant_idx on public.performance_records (attendant_id);

-- ---------------------------------------------------------------
-- Ausências (férias, atestados, faltas)
-- ---------------------------------------------------------------
create table public.absences (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attendant_id bigint not null references public.attendants (id) on delete cascade,
  type text not null check (type in ('vacation', 'sick', 'personal')),
  start_date date not null,
  end_date date not null,
  reason text not null default '',
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index absences_owner_start_idx on public.absences (owner_id, start_date);
create index absences_attendant_idx on public.absences (attendant_id);

-- ---------------------------------------------------------------
-- Calendário
-- ---------------------------------------------------------------
create table public.calendar_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  type text not null check (type in ('meeting', 'appointment', 'event', 'reminder')),
  date date not null,
  end_date date,
  start_time text,   -- "HH:MM"
  end_time text,     -- "HH:MM"
  location text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= date)
);
create index calendar_events_owner_date_idx on public.calendar_events (owner_id, date);

-- ---------------------------------------------------------------
-- Metas
-- ---------------------------------------------------------------
create table public.production_goals (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  channel text not null check (channel in ('Ligação', 'WhatsApp', 'E-mail', 'Outros')),
  daily_target integer not null check (daily_target >= 0),
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index production_goals_owner_idx on public.production_goals (owner_id);

create table public.role_goals (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null default 'Atendente',
  daily_target integer not null check (daily_target >= 0),
  description text,
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index role_goals_owner_idx on public.role_goals (owner_id);

-- ---------------------------------------------------------------
-- Estrutura (mapa de posições) — um layout por usuário
-- ---------------------------------------------------------------
create table public.structure_layouts (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  elements jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Histórico de importações de planilha
-- ---------------------------------------------------------------
create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name text,
  message text not null default '',
  imported integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  unique_attendants integer not null default 0,
  new_days date[] not null default '{}',
  created_at timestamptz not null default now()
);
create index import_logs_owner_created_idx on public.import_logs (owner_id, created_at desc);

-- ---------------------------------------------------------------
-- Preferências e anotação de análise — uma linha por usuário
-- ---------------------------------------------------------------
create table public.user_preferences (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  notifications boolean not null default true,
  email_reports boolean not null default true,
  language text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  analysis_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Gatilhos de updated_at
-- ---------------------------------------------------------------
create trigger attendants_updated_at before update on public.attendants
  for each row execute function public.set_updated_at();
create trigger performance_records_updated_at before update on public.performance_records
  for each row execute function public.set_updated_at();
create trigger absences_updated_at before update on public.absences
  for each row execute function public.set_updated_at();
create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();
create trigger production_goals_updated_at before update on public.production_goals
  for each row execute function public.set_updated_at();
create trigger role_goals_updated_at before update on public.role_goals
  for each row execute function public.set_updated_at();
create trigger structure_layouts_updated_at before update on public.structure_layouts
  for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Segurança: RLS ligado e cada usuário só acessa as próprias linhas
-- ---------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'attendants', 'performance_records', 'absences', 'calendar_events',
    'production_goals', 'role_goals', 'structure_layouts', 'import_logs',
    'user_preferences'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy "dono le" on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format(
      'create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', t);
    execute format(
      'create policy "dono altera" on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format(
      'create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', t);
  end loop;
end;
$$;

-- Garante que registros e ausências só apontem para atendentes do próprio dono
create or replace function public.check_attendant_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.attendants a
    where a.id = new.attendant_id and a.owner_id = new.owner_id
  ) then
    raise exception 'Atendente % não pertence a este usuário', new.attendant_id;
  end if;
  return new;
end;
$$;

create trigger performance_records_attendant_owner before insert or update on public.performance_records
  for each row execute function public.check_attendant_owner();
create trigger absences_attendant_owner before insert or update on public.absences
  for each row execute function public.check_attendant_owner();
