-- Base de conhecimento: o que o call center precisa saber (procedimentos, orientações, respostas prontas), um registro por conhecimento.
-- Versão básica: título, categoria (opcional) e texto. Aplicada primeiro no banco de TESTE; vai para a produção só com o "pode publicar".
create table public.knowledge_articles (
  id bigint generated always as identity primary key,
  title text not null check (length(btrim(title)) between 1 and 120),
  category text check (category is null or length(btrim(category)) between 1 and 40),
  content text not null check (length(btrim(content)) between 1 and 20000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_articles_category_idx on public.knowledge_articles (category);
create index knowledge_articles_updated_idx on public.knowledge_articles (updated_at desc);

create trigger knowledge_articles_updated_at before update on public.knowledge_articles for each row execute function public.set_updated_at();

alter table public.knowledge_articles enable row level security;

-- A equipe lê, cria e edita; só o administrador apaga
create policy "equipe lê" on public.knowledge_articles as permissive for select to authenticated using (( select is_member() as is_member));
create policy "equipe cria" on public.knowledge_articles as permissive for insert to authenticated with check (( select is_member() as is_member));
create policy "equipe edita" on public.knowledge_articles as permissive for update to authenticated using (( select is_member() as is_member)) with check (( select is_member() as is_member));
create policy "admin apaga" on public.knowledge_articles as permissive for delete to authenticated using (( select is_admin() as is_admin));

revoke all on public.knowledge_articles from anon, authenticated, service_role;
grant all on public.knowledge_articles to authenticated, service_role;
