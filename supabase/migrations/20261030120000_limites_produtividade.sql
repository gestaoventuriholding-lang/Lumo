-- Elos: limites de pausa e ocupação por indicador (ex.: pausa improdutiva no máximo 5%).
-- Um registro por indicador; dados compartilhados pela equipe (is_member), como as demais metas.

create table public.productivity_limits (
  id bigint primary key,  -- gerado pelo app (newId), como nas outras tabelas
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric text not null check (metric in ('pause_unproductive_percent', 'pause_percent', 'occupancy_min')),
  limit_value numeric(6, 2) not null check (limit_value >= 0 and limit_value <= 100),
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger productivity_limits_updated_at before update on public.productivity_limits
  for each row execute function public.set_updated_at();

alter table public.productivity_limits enable row level security;
revoke all on public.productivity_limits from anon;
create policy "equipe acessa tudo" on public.productivity_limits
  for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
