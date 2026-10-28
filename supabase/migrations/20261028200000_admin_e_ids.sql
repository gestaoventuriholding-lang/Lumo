-- Lumo: acesso de administrador e IDs gerados pelo app

-- ---------------------------------------------------------------
-- 1. IDs: o app gera IDs únicos (baseados em tempo), então as
--    colunas deixam de ser identity e passam a aceitar o valor enviado.
-- ---------------------------------------------------------------
alter table public.attendants alter column id drop identity;
alter table public.performance_records alter column id drop identity;
alter table public.absences alter column id drop identity;
alter table public.calendar_events alter column id drop identity;
alter table public.production_goals alter column id drop identity;
alter table public.role_goals alter column id drop identity;

-- ---------------------------------------------------------------
-- 2. Administradores: veem e alteram os dados de todos os usuários
-- ---------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon;
create policy "ve o proprio registro" on public.admins
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

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
    execute format(
      'create policy "admin acessa tudo" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- E-mails que viram admin automaticamente ao criar a conta
create or replace function public.grant_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) in ('amanda.silva@venturiholding.com.br') then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.grant_admin_on_signup() from public, anon, authenticated;

create trigger lumo_grant_admin_on_signup
  after insert on auth.users
  for each row execute function public.grant_admin_on_signup();

-- Caso a conta já exista
insert into public.admins (user_id)
select id from auth.users where lower(email) in ('amanda.silva@venturiholding.com.br')
on conflict do nothing;

-- ---------------------------------------------------------------
-- 3. Registros e ausências herdam o dono do atendente
--    (assim o admin pode lançar dados nos atendentes de qualquer usuário)
-- ---------------------------------------------------------------
create or replace function public.check_attendant_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;
