-- Elos: cargas horárias que a equipe cadastra em Configurações (ex.: 6h20, 8h, 12x36).
-- A lista começa vazia; o campo "carga horária" do colaborador continua sendo um texto.

create table public.working_hours_options (
  id bigint primary key,  -- gerado pelo app (newId), como nas outras tabelas
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger working_hours_options_updated_at before update on public.working_hours_options
  for each row execute function public.set_updated_at();

alter table public.working_hours_options enable row level security;
revoke all on public.working_hours_options from anon;
create policy "equipe acessa tudo" on public.working_hours_options
  for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
