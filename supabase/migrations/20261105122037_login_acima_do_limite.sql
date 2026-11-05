-- Ellos: regra do tempo logado acima do limite (padrão 12 horas por dia).
-- Quando o login de um colaborador num dia passa do limite, os atendimentos são gravados normalmente, mas login,
-- pausa e ocupação daquele dia ficam vazios (para não entrarem nas médias) e o gestor recebe um alerta no sininho.
--
-- Esta migração:
--  1) ACRESCENTA uma métrica ("login_max_hours") à lista de limites aceitos em public.productivity_limits.
--     Só a regra de validação (CHECK) da coluna `metric` muda; nenhuma linha é alterada ou apagada
--     (a tabela está vazia hoje). Os valores aceitos em `limit_value` (0 a 100) continuam iguais: 12 horas cabe.
--  2) CRIA a tabela public.login_alerts, que guarda o alerta e a situação dele (aberto, visto ou resolvido),
--     compartilhada pela equipe. Não altera nenhuma tabela existente.

-- 1) Nova métrica aceita nos limites ---------------------------------------------------------------
alter table public.productivity_limits drop constraint productivity_limits_metric_check;
alter table public.productivity_limits add constraint productivity_limits_metric_check
  check (metric = any (array['pause_unproductive_percent', 'pause_percent', 'occupancy_min', 'login_max_hours']));

-- 2) Alertas de tempo logado desconsiderado ---------------------------------------------------------
create table public.login_alerts (
  id bigint primary key,  -- gerado pelo app (newId), como nas outras tabelas
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attendant_id bigint not null references public.attendants (id) on delete cascade,
  alert_date date not null,
  login_seconds integer not null check (login_seconds >= 0),   -- tempo que veio da Escallo (guardado só aqui)
  limit_seconds integer not null check (limit_seconds > 0),    -- limite vigente quando o alerta foi gerado
  status text not null default 'open' check (status in ('open', 'seen', 'resolved')),
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attendant_id, alert_date)  -- um alerta por colaborador e dia
);

create index login_alerts_status_idx on public.login_alerts (status);
create index login_alerts_date_idx on public.login_alerts (alert_date desc);

-- o dono vem do colaborador (igual às outras tabelas que têm attendant_id)
create trigger login_alerts_attendant_owner before insert or update on public.login_alerts
  for each row execute function public.check_attendant_owner();
create trigger login_alerts_updated_at before update on public.login_alerts
  for each row execute function public.set_updated_at();

-- registra quem mudou a situação e quando (o app não consegue falsificar isso)
create or replace function public.login_alerts_track_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger login_alerts_track_status before update on public.login_alerts
  for each row execute function public.login_alerts_track_status();

alter table public.login_alerts enable row level security;
revoke all on public.login_alerts from anon;
create policy "equipe acessa tudo" on public.login_alerts
  for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
