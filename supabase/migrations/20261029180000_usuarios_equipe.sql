-- Elos: quem pode entrar (aba Usuários) e dados da central compartilhados entre os membros.
-- Membro = pessoa cadastrada em public.members ou administrador (public.admins).

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;
revoke all on public.members from anon;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()))
      or exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

create policy "ve o proprio acesso" on public.members
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "admin gerencia acessos" on public.members
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Dados da central: todos os membros veem e editam os mesmos registros
do $$
declare t text;
begin
  foreach t in array array['attendants', 'performance_records', 'absences', 'calendar_events',
                           'production_goals', 'role_goals', 'import_logs', 'productivity_reports',
                           'structure_layouts']
  loop
    execute format('drop policy if exists "dono le" on public.%I', t);
    execute format('drop policy if exists "dono cria" on public.%I', t);
    execute format('drop policy if exists "dono altera" on public.%I', t);
    execute format('drop policy if exists "dono apaga" on public.%I', t);
    execute format(
      'create policy "equipe acessa tudo" on public.%I for all to authenticated using ((select public.is_member())) with check ((select public.is_member()))',
      t
    );
  end loop;
end $$;
