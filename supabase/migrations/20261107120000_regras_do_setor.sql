-- Regras do setor e assinaturas por pessoa.
-- Depois da primeira assinatura o texto da regra fica travado; para mudar, cria-se uma NOVA VERSÃO
-- (a versão antiga é arquivada e guarda as assinaturas dela).
-- Aplicada primeiro no banco de TESTE; vai para a produção junto com a publicação.

create table public.rules (
  id bigint primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null check (length(btrim(description)) between 1 and 4000),
  category text check (category is null or length(btrim(category)) between 1 and 40),
  effective_from date not null,
  applies_to text not null default 'all' check (applies_to in ('all', 'Atendente', 'Confirmação de agenda')),
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  version integer not null default 1 check (version >= 1),
  previous_id bigint references public.rules(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'archived') = (archived_at is not null))
);

create table public.rule_signatures (
  id bigint primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, -- herdado do colaborador pelo gatilho
  rule_id bigint not null references public.rules(id) on delete cascade,
  attendant_id bigint not null references public.attendants(id) on delete cascade,
  signed_on date not null,
  note text not null default '' check (length(note) <= 200),
  recorded_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, attendant_id)
);

create index rules_status_effective_idx on public.rules (status, effective_from desc);
create index rules_previous_idx on public.rules (previous_id);
create index rule_signatures_rule_idx on public.rule_signatures (rule_id);
create index rule_signatures_attendant_idx on public.rule_signatures (attendant_id);

-- Regra já assinada: título, descrição, vigência e "aplica-se a" não mudam mais (cria-se uma nova versão)
create function public.rules_travar_texto()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if (new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.effective_from is distinct from old.effective_from
      or new.applies_to is distinct from old.applies_to)
     and exists (select 1 from public.rule_signatures s where s.rule_id = old.id) then
    raise exception 'Esta regra já tem assinaturas: o texto não pode mudar. Crie uma nova versão.' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

create trigger rules_travar_texto before update on public.rules for each row execute function public.rules_travar_texto();
create trigger rules_updated_at before update on public.rules for each row execute function public.set_updated_at();
create trigger rule_signatures_updated_at before update on public.rule_signatures for each row execute function public.set_updated_at();
create trigger rule_signatures_attendant_owner before insert or update on public.rule_signatures for each row execute function public.check_attendant_owner();

alter table public.rules enable row level security;
alter table public.rule_signatures enable row level security;

-- Regras: a equipe lê, cria e edita; só o administrador apaga (a tela só arquiva)
create policy "equipe lê" on public.rules as permissive for select to authenticated using (( select is_member() as is_member));
create policy "equipe cria" on public.rules as permissive for insert to authenticated with check (( select is_member() as is_member));
create policy "equipe edita" on public.rules as permissive for update to authenticated using (( select is_member() as is_member)) with check (( select is_member() as is_member));
create policy "admin apaga" on public.rules as permissive for delete to authenticated using (( select is_admin() as is_admin));

-- Assinaturas: a equipe faz tudo (inclusive corrigir ou remover uma assinatura marcada errada)
create policy "equipe acessa tudo" on public.rule_signatures as permissive for all to authenticated using (( select is_member() as is_member)) with check (( select is_member() as is_member));

revoke all on public.rules, public.rule_signatures from anon, authenticated, service_role;
grant all on public.rules, public.rule_signatures to authenticated, service_role;
