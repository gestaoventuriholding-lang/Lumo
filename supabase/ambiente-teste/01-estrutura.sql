-- Ellos: estrutura do banco de TESTE (projeto ellos-teste), extraída do catálogo do banco de produção em 06/11/2026.
-- Só estrutura (tabelas, regras, funções, gatilhos, RLS, permissões, Realtime). Nenhum dado de pessoa.
-- Diferenças deliberadas em relação à produção:
--   * disparar_sync_escallo aponta para o projeto de teste (e não é usada: o teste não tem agendador);
--   * sync_config começa DESLIGADO.
-- Nunca rode este arquivo na produção.

-- ================================================================ tabelas
create table public.absences (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  attendant_id bigint not null,
  type text not null,
  start_date date not null,
  end_date date not null,
  reason text default ''::text not null,
  status text default 'approved'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.admins (
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.attendants (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  name text not null,
  role text default 'Atendente'::text not null,
  service_channel text not null,
  working_hours text default ''::text not null,
  jornada_start text default ''::text not null,
  jornada_end text default ''::text not null,
  observation text default ''::text not null,
  registration_date date default CURRENT_DATE not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  escallo_codigo bigint,
  active boolean default true not null,
  terminated_on date
);

create table public.calendar_events (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  title text not null,
  type text not null,
  date date not null,
  end_date date,
  start_time text,
  end_time text,
  location text,
  description text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.import_logs (
  id uuid default gen_random_uuid() not null,
  owner_id uuid default auth.uid() not null,
  file_name text,
  message text default ''::text not null,
  imported integer default 0 not null,
  updated integer default 0 not null,
  skipped integer default 0 not null,
  unique_attendants integer default 0 not null,
  new_days date[] default '{}'::date[] not null,
  created_at timestamp with time zone default now() not null
);

create table public.incidents (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  type text not null,
  occurred_on date not null,
  channel text not null,
  attendant_id bigint,
  attendant_name text default ''::text not null,
  protocol text not null,
  description text not null,
  severity text not null,
  status text default 'open'::text not null,
  action_taken text default ''::text not null,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.login_alerts (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  attendant_id bigint not null,
  alert_date date not null,
  login_seconds integer not null,
  limit_seconds integer not null,
  status text default 'open'::text not null,
  status_changed_at timestamp with time zone,
  status_changed_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.members (
  user_id uuid not null,
  email text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.performance_records (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  attendant_id bigint not null,
  date date not null,
  channel text not null,
  attendances_count integer default 0 not null,
  average_time_minutes numeric(8,2) default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.production_goals (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  channel text not null,
  daily_target integer not null,
  status text default 'Ativo'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.productivity_limits (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  metric text not null,
  limit_value numeric(6,2) not null,
  status text default 'Ativo'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.productivity_reports (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  attendant_id bigint not null,
  period_start date not null,
  period_end date not null,
  channel text not null,
  inbound_count integer,
  outbound_count integer,
  attendances_count integer default 0 not null,
  talk_seconds bigint,
  tma_seconds integer,
  login_seconds bigint,
  pause_seconds bigint,
  pause_percent numeric(6,2),
  pause_legal_seconds bigint,
  pause_productive_seconds bigint,
  pause_unproductive_seconds bigint,
  occupancy_to1 numeric(6,2),
  occupancy_to2 numeric(6,2),
  occupancy_to3 numeric(6,2),
  occupancy_to4 numeric(6,2),
  per_hour numeric(8,2),
  report_code text,
  source_file text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.role_goals (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  role text default 'Atendente'::text not null,
  daily_target integer not null,
  description text,
  status text default 'Ativo'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.structure_layouts (
  owner_id uuid default auth.uid() not null,
  elements jsonb default '[]'::jsonb not null,
  history jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.sync_config (
  id boolean default true not null,
  enabled boolean default false not null,
  updated_at timestamp with time zone default now() not null
);

create table public.sync_runs (
  id uuid default gen_random_uuid() not null,
  mode text not null,
  triggered_by text not null,
  days date[] default '{}'::date[] not null,
  started_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone,
  status text default 'executando'::text not null,
  rel025_agents integer,
  rel090_agents integer,
  rows_inserted integer default 0 not null,
  rows_updated integer default 0 not null,
  rows_skipped_manual integer default 0 not null,
  login_blanked integer default 0 not null,
  alerts_created integer default 0 not null,
  unlinked_with_activity integer default 0 not null,
  error text,
  duration_ms integer,
  ignored_terminated integer default 0 not null,
  warnings jsonb default '[]'::jsonb not null
);

create table public.user_preferences (
  owner_id uuid default auth.uid() not null,
  notifications boolean default true not null,
  email_reports boolean default true not null,
  language text default 'pt-BR'::text not null,
  timezone text default 'America/Sao_Paulo'::text not null,
  analysis_note text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.working_hours_options (
  id bigint not null,
  owner_id uuid default auth.uid() not null,
  label text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create sequence public.sync_id_seq;

-- ================================================================ chaves primárias, únicas e checagens
alter table public.absences add constraint absences_pkey PRIMARY KEY (id);
alter table public.admins add constraint admins_pkey PRIMARY KEY (user_id);
alter table public.attendants add constraint attendants_pkey PRIMARY KEY (id);
alter table public.calendar_events add constraint calendar_events_pkey PRIMARY KEY (id);
alter table public.import_logs add constraint import_logs_pkey PRIMARY KEY (id);
alter table public.incidents add constraint incidents_pkey PRIMARY KEY (id);
alter table public.login_alerts add constraint login_alerts_pkey PRIMARY KEY (id);
alter table public.members add constraint members_pkey PRIMARY KEY (user_id);
alter table public.performance_records add constraint performance_records_pkey PRIMARY KEY (id);
alter table public.production_goals add constraint production_goals_pkey PRIMARY KEY (id);
alter table public.productivity_limits add constraint productivity_limits_pkey PRIMARY KEY (id);
alter table public.productivity_reports add constraint productivity_reports_pkey PRIMARY KEY (id);
alter table public.role_goals add constraint role_goals_pkey PRIMARY KEY (id);
alter table public.structure_layouts add constraint structure_layouts_pkey PRIMARY KEY (owner_id);
alter table public.sync_config add constraint sync_config_pkey PRIMARY KEY (id);
alter table public.sync_runs add constraint sync_runs_pkey PRIMARY KEY (id);
alter table public.user_preferences add constraint user_preferences_pkey PRIMARY KEY (owner_id);
alter table public.working_hours_options add constraint working_hours_options_pkey PRIMARY KEY (id);
alter table public.login_alerts add constraint login_alerts_attendant_id_alert_date_key UNIQUE (attendant_id, alert_date);
alter table public.performance_records add constraint performance_records_attendant_id_date_channel_key UNIQUE (attendant_id, date, channel);
alter table public.productivity_reports add constraint productivity_reports_attendant_id_period_start_period_end_c_key UNIQUE (attendant_id, period_start, period_end, channel);
alter table public.absences add constraint absences_check CHECK ((end_date >= start_date));
alter table public.absences add constraint absences_status_check CHECK ((status = ANY (ARRAY['approved'::text, 'pending'::text, 'rejected'::text])));
alter table public.absences add constraint absences_type_check CHECK ((type = ANY (ARRAY['vacation'::text, 'sick'::text, 'personal'::text])));
alter table public.attendants add constraint attendants_name_check CHECK ((char_length(TRIM(BOTH FROM name)) > 0));
alter table public.attendants add constraint attendants_role_check CHECK ((role = ANY (ARRAY['Atendente'::text, 'Confirmação de agenda'::text])));
alter table public.attendants add constraint attendants_service_channel_check CHECK ((service_channel = ANY (ARRAY['Ligação'::text, 'WhatsApp'::text, 'Ligação e WhatsApp'::text])));
alter table public.attendants add constraint attendants_terminated_check CHECK (((active AND (terminated_on IS NULL)) OR ((NOT active) AND (terminated_on IS NOT NULL))));
alter table public.calendar_events add constraint calendar_events_check CHECK (((end_date IS NULL) OR (end_date >= date)));
alter table public.calendar_events add constraint calendar_events_title_check CHECK ((char_length(TRIM(BOTH FROM title)) > 0));
alter table public.calendar_events add constraint calendar_events_type_check CHECK ((type = ANY (ARRAY['meeting'::text, 'appointment'::text, 'event'::text, 'reminder'::text])));
alter table public.incidents add constraint incidents_channel_check CHECK ((channel = ANY (ARRAY['Ligação'::text, 'WhatsApp'::text])));
alter table public.incidents add constraint incidents_check CHECK (((status <> 'resolved'::text) OR (length(btrim(action_taken)) > 0)));
alter table public.incidents add constraint incidents_description_check CHECK (((length(btrim(description)) >= 1) AND (length(btrim(description)) <= 600)));
alter table public.incidents add constraint incidents_protocol_check CHECK (((length(btrim(protocol)) >= 1) AND (length(btrim(protocol)) <= 60)));
alter table public.incidents add constraint incidents_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public.incidents add constraint incidents_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text])));
alter table public.incidents add constraint incidents_type_check CHECK ((type = ANY (ARRAY['complaint'::text, 'scheduling_error'::text, 'incorrect_scheduling'::text])));
alter table public.login_alerts add constraint login_alerts_limit_seconds_check CHECK ((limit_seconds > 0));
alter table public.login_alerts add constraint login_alerts_login_seconds_check CHECK ((login_seconds >= 0));
alter table public.login_alerts add constraint login_alerts_status_check CHECK ((status = ANY (ARRAY['open'::text, 'seen'::text, 'resolved'::text])));
alter table public.performance_records add constraint performance_records_attendances_count_check CHECK ((attendances_count >= 0));
alter table public.performance_records add constraint performance_records_average_time_minutes_check CHECK ((average_time_minutes >= (0)::numeric));
alter table public.performance_records add constraint performance_records_channel_check CHECK ((channel = ANY (ARRAY['Ligação'::text, 'WhatsApp'::text, 'E-mail'::text, 'Outros'::text])));
alter table public.production_goals add constraint production_goals_channel_check CHECK ((channel = ANY (ARRAY['Ligação'::text, 'WhatsApp'::text, 'E-mail'::text, 'Outros'::text])));
alter table public.production_goals add constraint production_goals_daily_target_check CHECK ((daily_target >= 0));
alter table public.production_goals add constraint production_goals_status_check CHECK ((status = ANY (ARRAY['Ativo'::text, 'Inativo'::text])));
alter table public.productivity_limits add constraint productivity_limits_limit_value_check CHECK (((limit_value >= (0)::numeric) AND (limit_value <= (100)::numeric)));
alter table public.productivity_limits add constraint productivity_limits_metric_check CHECK ((metric = ANY (ARRAY['pause_unproductive_percent'::text, 'pause_percent'::text, 'occupancy_min'::text, 'login_max_hours'::text])));
alter table public.productivity_limits add constraint productivity_limits_status_check CHECK ((status = ANY (ARRAY['Ativo'::text, 'Inativo'::text])));
alter table public.productivity_reports add constraint productivity_reports_attendances_count_check CHECK ((attendances_count >= 0));
alter table public.productivity_reports add constraint productivity_reports_channel_check CHECK ((channel = ANY (ARRAY['Ligação'::text, 'WhatsApp'::text, 'E-mail'::text, 'Outros'::text])));
alter table public.productivity_reports add constraint productivity_reports_check CHECK ((period_end >= period_start));
alter table public.productivity_reports add constraint productivity_reports_inbound_count_check CHECK ((inbound_count >= 0));
alter table public.productivity_reports add constraint productivity_reports_login_seconds_check CHECK ((login_seconds >= 0));
alter table public.productivity_reports add constraint productivity_reports_outbound_count_check CHECK ((outbound_count >= 0));
alter table public.productivity_reports add constraint productivity_reports_pause_legal_seconds_check CHECK ((pause_legal_seconds >= 0));
alter table public.productivity_reports add constraint productivity_reports_pause_productive_seconds_check CHECK ((pause_productive_seconds >= 0));
alter table public.productivity_reports add constraint productivity_reports_pause_seconds_check CHECK ((pause_seconds >= 0));
alter table public.productivity_reports add constraint productivity_reports_pause_unproductive_seconds_check CHECK ((pause_unproductive_seconds >= 0));
alter table public.productivity_reports add constraint productivity_reports_talk_seconds_check CHECK ((talk_seconds >= 0));
alter table public.productivity_reports add constraint productivity_reports_tma_seconds_check CHECK ((tma_seconds >= 0));
alter table public.role_goals add constraint role_goals_daily_target_check CHECK ((daily_target >= 0));
alter table public.role_goals add constraint role_goals_status_check CHECK ((status = ANY (ARRAY['Ativo'::text, 'Inativo'::text])));
alter table public.sync_config add constraint sync_config_id_check CHECK (id);
alter table public.sync_runs add constraint sync_runs_mode_check CHECK ((mode = ANY (ARRAY['hoje'::text, 'fechamento'::text, 'manual'::text, 'simulacao'::text])));
alter table public.sync_runs add constraint sync_runs_status_check CHECK ((status = ANY (ARRAY['executando'::text, 'ok'::text, 'erro'::text, 'pulado'::text])));
alter table public.sync_runs add constraint sync_runs_triggered_by_check CHECK ((triggered_by = ANY (ARRAY['agendador'::text, 'pessoa'::text])));
alter table public.working_hours_options add constraint working_hours_options_label_check CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 40)));

-- ================================================================ chaves estrangeiras
alter table public.absences add constraint absences_attendant_id_fkey FOREIGN KEY (attendant_id) REFERENCES public.attendants(id) ON DELETE CASCADE;
alter table public.absences add constraint absences_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.admins add constraint admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.attendants add constraint attendants_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.calendar_events add constraint calendar_events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.import_logs add constraint import_logs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.incidents add constraint incidents_attendant_id_fkey FOREIGN KEY (attendant_id) REFERENCES public.attendants(id) ON DELETE SET NULL;
alter table public.incidents add constraint incidents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.login_alerts add constraint login_alerts_attendant_id_fkey FOREIGN KEY (attendant_id) REFERENCES public.attendants(id) ON DELETE CASCADE;
alter table public.login_alerts add constraint login_alerts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.login_alerts add constraint login_alerts_status_changed_by_fkey FOREIGN KEY (status_changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.members add constraint members_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.members add constraint members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.performance_records add constraint performance_records_attendant_id_fkey FOREIGN KEY (attendant_id) REFERENCES public.attendants(id) ON DELETE CASCADE;
alter table public.performance_records add constraint performance_records_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.production_goals add constraint production_goals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.productivity_limits add constraint productivity_limits_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.productivity_reports add constraint productivity_reports_attendant_id_fkey FOREIGN KEY (attendant_id) REFERENCES public.attendants(id) ON DELETE CASCADE;
alter table public.productivity_reports add constraint productivity_reports_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.role_goals add constraint role_goals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.structure_layouts add constraint structure_layouts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_preferences add constraint user_preferences_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.working_hours_options add constraint working_hours_options_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ================================================================ índices
CREATE INDEX absences_attendant_idx ON public.absences USING btree (attendant_id);
CREATE INDEX absences_owner_start_idx ON public.absences USING btree (owner_id, start_date);
CREATE INDEX attendants_owner_idx ON public.attendants USING btree (owner_id);
CREATE INDEX calendar_events_owner_date_idx ON public.calendar_events USING btree (owner_id, date);
CREATE INDEX import_logs_owner_created_idx ON public.import_logs USING btree (owner_id, created_at DESC);
CREATE INDEX incidents_attendant_idx ON public.incidents USING btree (attendant_id);
CREATE INDEX incidents_occurred_on_idx ON public.incidents USING btree (occurred_on DESC);
CREATE INDEX incidents_protocol_idx ON public.incidents USING btree (protocol);
CREATE INDEX incidents_status_idx ON public.incidents USING btree (status);
CREATE INDEX login_alerts_date_idx ON public.login_alerts USING btree (alert_date DESC);
CREATE INDEX login_alerts_status_idx ON public.login_alerts USING btree (status);
CREATE INDEX performance_records_attendant_idx ON public.performance_records USING btree (attendant_id);
CREATE INDEX performance_records_owner_date_idx ON public.performance_records USING btree (owner_id, date);
CREATE INDEX production_goals_owner_idx ON public.production_goals USING btree (owner_id);
CREATE INDEX productivity_reports_attendant_idx ON public.productivity_reports USING btree (attendant_id);
CREATE INDEX productivity_reports_owner_period_idx ON public.productivity_reports USING btree (owner_id, period_start, period_end);
CREATE INDEX role_goals_owner_idx ON public.role_goals USING btree (owner_id);
CREATE INDEX sync_runs_started_at_idx ON public.sync_runs USING btree (started_at DESC);
CREATE UNIQUE INDEX attendants_escallo_codigo_key ON public.attendants USING btree (escallo_codigo) WHERE (escallo_codigo IS NOT NULL);

-- ================================================================ funções
CREATE OR REPLACE FUNCTION public.aplicar_sync_dia(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  dia date := (p->>'dia')::date;
  r jsonb; a jsonb;
  ja_prod boolean; fonte text; ja_desemp boolean;
  ins int := 0; upd int := 0; pul int := 0; ali int := 0;
  criou boolean;
begin
  for r in select * from jsonb_array_elements(coalesce(p->'linhas', '[]'::jsonb)) loop
    select source_file into fonte from public.productivity_reports
      where attendant_id = (r->>'attendant_id')::bigint and period_start = dia and period_end = dia and channel = r->>'channel';
    ja_prod := found;
    ja_desemp := false;
    select true into ja_desemp from public.performance_records
      where attendant_id = (r->>'attendant_id')::bigint and date = dia and channel = r->>'channel';
    ja_desemp := coalesce(ja_desemp, false);
    if (ja_prod and fonte is distinct from 'API Escallo') or (ja_desemp and not ja_prod) then
      pul := pul + 1;
      continue;
    end if;

    insert into public.productivity_reports (id, attendant_id, period_start, period_end, channel, inbound_count, outbound_count,
      attendances_count, talk_seconds, tma_seconds, login_seconds, pause_seconds, pause_percent, pause_legal_seconds,
      pause_productive_seconds, pause_unproductive_seconds, occupancy_to1, occupancy_to2, occupancy_to3, occupancy_to4,
      per_hour, report_code, source_file)
    values (public.novo_id_sync(), (r->>'attendant_id')::bigint, dia, dia, r->>'channel', (r->>'inbound')::int, (r->>'outbound')::int,
      (r->>'atend')::int, (r->>'talk')::bigint, (r->>'tma')::int, (r->>'login')::bigint, (r->>'pause')::bigint, (r->>'pause_pct')::numeric,
      (r->>'legal')::bigint, (r->>'productive')::bigint, (r->>'unproductive')::bigint, (r->>'to1')::numeric, (r->>'to2')::numeric,
      (r->>'to3')::numeric, (r->>'to4')::numeric, (r->>'per_hour')::numeric, r->>'report_code', 'API Escallo')
    on conflict (attendant_id, period_start, period_end, channel) do update set
      inbound_count = excluded.inbound_count, outbound_count = excluded.outbound_count, attendances_count = excluded.attendances_count,
      talk_seconds = excluded.talk_seconds, tma_seconds = excluded.tma_seconds, login_seconds = excluded.login_seconds,
      pause_seconds = excluded.pause_seconds, pause_percent = excluded.pause_percent, pause_legal_seconds = excluded.pause_legal_seconds,
      pause_productive_seconds = excluded.pause_productive_seconds, pause_unproductive_seconds = excluded.pause_unproductive_seconds,
      occupancy_to1 = excluded.occupancy_to1, occupancy_to2 = excluded.occupancy_to2, occupancy_to3 = excluded.occupancy_to3,
      occupancy_to4 = excluded.occupancy_to4, per_hour = excluded.per_hour, updated_at = now();

    insert into public.performance_records (id, attendant_id, date, channel, attendances_count, average_time_minutes)
    values (public.novo_id_sync(), (r->>'attendant_id')::bigint, dia, r->>'channel', (r->>'atend')::int, (r->>'media_min')::numeric)
    on conflict (attendant_id, date, channel) do update set
      attendances_count = excluded.attendances_count, average_time_minutes = excluded.average_time_minutes, updated_at = now();

    if ja_prod then upd := upd + 1; else ins := ins + 1; end if;
  end loop;

  for a in select * from jsonb_array_elements(coalesce(p->'alertas', '[]'::jsonb)) loop
    criou := null;
    insert into public.login_alerts (id, attendant_id, alert_date, login_seconds, limit_seconds, status)
    values (public.novo_id_sync(), (a->>'attendant_id')::bigint, dia, (a->>'login_seconds')::int, (a->>'limit_seconds')::int, 'open')
    on conflict (attendant_id, alert_date) do update set login_seconds = excluded.login_seconds, updated_at = now()
      where public.login_alerts.status <> 'resolved'
    returning (xmax = 0) into criou;
    if coalesce(criou, false) then ali := ali + 1; end if;
  end loop;

  return jsonb_build_object('inseridas', ins, 'atualizadas', upd, 'puladas_manuais', pul, 'alertas_novos', ali);
end $function$;

CREATE OR REPLACE FUNCTION public.check_attendant_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_owner uuid;
begin
  select a.owner_id into v_owner from public.attendants a where a.id = new.attendant_id;
  if v_owner is null then
    raise exception 'Atendente % não encontrado', new.attendant_id;
  end if;
  new.owner_id := v_owner;
  return new;
end;
$function$;

-- (no teste aponta para o projeto de teste; não é usada: o teste não tem agendador)
CREATE OR REPLACE FUNCTION public.disparar_sync_escallo(p_modo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare chave text;
begin
  if p_modo not in ('hoje', 'fechamento') then raise exception 'modo inválido'; end if;
  select decrypted_secret into chave from vault.decrypted_secrets where name = 'escallo_sync_key';
  perform net.http_post(
    url := 'https://wkyvcjktauopvgqkaucp.supabase.co/functions/v1/escallo-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-key', chave),
    body := jsonb_build_object('modo', p_modo),
    timeout_milliseconds := 120000);
end $function$;

CREATE OR REPLACE FUNCTION public.grant_admin_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if lower(new.email) in ('amanda.silva@venturiholding.com.br') then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$function$;

CREATE OR REPLACE FUNCTION public.is_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.members where user_id = (select auth.uid()))
      or exists (select 1 from public.admins where user_id = (select auth.uid()));
$function$;

CREATE OR REPLACE FUNCTION public.login_alerts_track_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.novo_id_sync()
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select (extract(epoch from clock_timestamp()) * 1000000)::bigint + (nextval('public.sync_id_seq') % 1000)
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_chave_valida(p_chave text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(p_chave is not null and p_chave = (select decrypted_secret from vault.decrypted_secrets where name = 'escallo_sync_key'), false)
$function$;

CREATE OR REPLACE FUNCTION public.sync_definir_ativo(p_ativo boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'apenas administrador'; end if;
  update public.sync_config set enabled = p_ativo, updated_at = now() where id = true;
end $function$;

-- Quem pode executar (igual à produção): funções de sincronização só o service_role; is_admin/is_member/sync_definir_ativo também o logado
revoke execute on function public.aplicar_sync_dia(jsonb) from public, anon, authenticated;
revoke execute on function public.disparar_sync_escallo(text) from public, anon, authenticated;
revoke execute on function public.grant_admin_on_signup() from public, anon, authenticated;
revoke execute on function public.novo_id_sync() from public, anon, authenticated;
revoke execute on function public.sync_chave_valida(text) from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_member() from public, anon;
revoke execute on function public.sync_definir_ativo(boolean) from public, anon;
grant execute on function public.aplicar_sync_dia(jsonb) to service_role;
grant execute on function public.disparar_sync_escallo(text) to service_role;
grant execute on function public.grant_admin_on_signup() to service_role;
grant execute on function public.novo_id_sync() to service_role;
grant execute on function public.sync_chave_valida(text) to service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_member() to authenticated, service_role;
grant execute on function public.sync_definir_ativo(boolean) to authenticated, service_role;

-- ================================================================ gatilhos
CREATE TRIGGER absences_attendant_owner BEFORE INSERT OR UPDATE ON public.absences FOR EACH ROW EXECUTE FUNCTION public.check_attendant_owner();
CREATE TRIGGER absences_updated_at BEFORE UPDATE ON public.absences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER attendants_updated_at BEFORE UPDATE ON public.attendants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER login_alerts_attendant_owner BEFORE INSERT OR UPDATE ON public.login_alerts FOR EACH ROW EXECUTE FUNCTION public.check_attendant_owner();
CREATE TRIGGER login_alerts_track_status BEFORE UPDATE ON public.login_alerts FOR EACH ROW EXECUTE FUNCTION public.login_alerts_track_status();
CREATE TRIGGER login_alerts_updated_at BEFORE UPDATE ON public.login_alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER lumo_grant_admin_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_admin_on_signup();
CREATE TRIGGER performance_records_attendant_owner BEFORE INSERT OR UPDATE ON public.performance_records FOR EACH ROW EXECUTE FUNCTION public.check_attendant_owner();
CREATE TRIGGER performance_records_updated_at BEFORE UPDATE ON public.performance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER production_goals_updated_at BEFORE UPDATE ON public.production_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER productivity_limits_updated_at BEFORE UPDATE ON public.productivity_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER productivity_reports_attendant_owner BEFORE INSERT OR UPDATE ON public.productivity_reports FOR EACH ROW EXECUTE FUNCTION public.check_attendant_owner();
CREATE TRIGGER productivity_reports_updated_at BEFORE UPDATE ON public.productivity_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER role_goals_updated_at BEFORE UPDATE ON public.role_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER structure_layouts_updated_at BEFORE UPDATE ON public.structure_layouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER working_hours_options_updated_at BEFORE UPDATE ON public.working_hours_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================ RLS e políticas
alter table public.absences enable row level security;
alter table public.admins enable row level security;
alter table public.attendants enable row level security;
alter table public.calendar_events enable row level security;
alter table public.import_logs enable row level security;
alter table public.incidents enable row level security;
alter table public.login_alerts enable row level security;
alter table public.members enable row level security;
alter table public.performance_records enable row level security;
alter table public.production_goals enable row level security;
alter table public.productivity_limits enable row level security;
alter table public.productivity_reports enable row level security;
alter table public.role_goals enable row level security;
alter table public.structure_layouts enable row level security;
alter table public.sync_config enable row level security;
alter table public.sync_runs enable row level security;
alter table public.user_preferences enable row level security;
alter table public.working_hours_options enable row level security;

create policy "admin acessa tudo" on public.absences as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin acessa tudo" on public.attendants as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin acessa tudo" on public.calendar_events as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin acessa tudo" on public.import_logs as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin acessa tudo" on public.performance_records as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin acessa tudo" on public.production_goals as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin acessa tudo" on public.productivity_reports as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin acessa tudo" on public.role_goals as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin acessa tudo" on public.structure_layouts as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin acessa tudo" on public.user_preferences as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "admin gerencia acessos" on public.members as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "dono altera" on public.user_preferences as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = owner_id)) with check ((( SELECT auth.uid() AS uid) = owner_id));
create policy "dono apaga" on public.user_preferences as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = owner_id));
create policy "dono cria" on public.user_preferences as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = owner_id));
create policy "dono le" on public.user_preferences as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = owner_id));
create policy "equipe acessa tudo" on public.absences as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.attendants as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.calendar_events as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.import_logs as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.incidents as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.login_alerts as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.performance_records as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.production_goals as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.productivity_limits as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.productivity_reports as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.role_goals as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.structure_layouts as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe acessa tudo" on public.working_hours_options as PERMISSIVE for ALL to authenticated using (( SELECT is_member() AS is_member)) with check (( SELECT is_member() AS is_member));
create policy "equipe lê a configuração" on public.sync_config as PERMISSIVE for SELECT to public using (is_member());
create policy "equipe lê as execuções" on public.sync_runs as PERMISSIVE for SELECT to public using (is_member());
create policy "ve o proprio acesso" on public.members as PERMISSIVE for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT is_admin() AS is_admin)));
create policy "ve o proprio registro" on public.admins as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

-- ================================================================ permissões das tabelas (igual à produção)
revoke all on all tables in schema public from anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on public.sync_config, public.sync_runs to anon;

-- ================================================================ Realtime e configuração inicial
alter publication supabase_realtime add table public.performance_records, public.productivity_reports, public.login_alerts, public.sync_runs;

insert into public.sync_config (id, enabled) values (true, false); -- teste: sem agendador
