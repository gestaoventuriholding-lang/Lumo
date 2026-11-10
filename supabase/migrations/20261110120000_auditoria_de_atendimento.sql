-- Auditoria de atendimento.
-- NÃO guarda texto de conversa nem áudio (LGPD): só o protocolo. A conversa/gravação é buscada na Escallo na hora.
-- Aplicada primeiro no banco de TESTE; vai para a produção só com o "pode publicar".

-- Metas e nota mínima (linha única)
create table public.audit_settings (
  id bigint primary key default 1 check (id = 1),
  min_score numeric not null default 85 check (min_score between 0 and 100),
  monthly_target integer not null default 4 check (monthly_target between 0 and 100), -- auditorias por agente por mês
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.audit_settings (id) values (1);

-- Checklist com versões: cada versão é uma linha; a auditoria aponta para a versão em que foi feita.
create table public.audit_checklists (
  id bigint primary key,
  name text not null check (length(btrim(name)) between 1 and 80),
  funcao text not null default 'Atendente' check (funcao in ('Atendente', 'Confirmação de agenda')),
  version integer not null default 1 check (version >= 1),
  previous_id bigint references public.audit_checklists(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index audit_checklists_uma_ativa on public.audit_checklists (funcao) where status = 'active';

create table public.audit_checklist_items (
  id bigint primary key,
  checklist_id bigint not null references public.audit_checklists(id) on delete cascade,
  position integer not null default 0,
  title text not null check (length(btrim(title)) between 1 and 160),
  hint text not null default '' check (length(hint) <= 400),
  weight numeric not null default 1 check (weight >= 0 and weight <= 1000),
  eliminatory boolean not null default false, -- "Não atende" nele zera a nota
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_items_checklist_idx on public.audit_checklist_items (checklist_id, position);

-- answers: [{"item_id": 123, "result": "atende|parcial|nao_atende|nao_aplica", "note": ""}]
create table public.audits (
  id bigint primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, -- herdado do colaborador pelo gatilho
  attendant_id bigint not null references public.attendants(id) on delete cascade,
  checklist_id bigint not null references public.audit_checklists(id),
  channel text not null check (channel in ('Ligação', 'WhatsApp')),
  attended_on date not null,
  protocol text not null check (length(btrim(protocol)) between 1 and 60),
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  score numeric check (score is null or score between 0 and 100), -- calculada pelo banco
  eliminated boolean not null default false,
  general_note text not null default '' check (length(general_note) <= 1000),
  feedback text not null default '' check (length(feedback) <= 2000),
  feedback_given_on date, -- "feedback dado em"
  ack_mode text check (ack_mode in ('agente', 'supervisora')),
  ack_at timestamptz,
  auditor_id uuid default auth.uid() references auth.users(id) on delete set null,
  auditor_email text not null default coalesce(auth.jwt() ->> 'email', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (protocol, channel) -- o mesmo atendimento não é auditado duas vezes
);
create index audits_attendant_date_idx on public.audits (attendant_id, attended_on desc);
create index audits_checklist_idx on public.audits (checklist_id);

-- Nota = soma(peso x {1; 0,5; 0}) / soma(peso dos critérios que valeram) x 100.
-- Eliminatório em "Não atende" zera. Se tudo for "Não se aplica", fica sem nota.
create function public.audits_calcula_nota()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_total numeric := 0;
  v_ganho numeric := 0;
  v_elim boolean := false;
  v_conta integer := 0;
  r record;
begin
  for r in
    select i.weight, i.eliminatory, a ->> 'result' as result
      from jsonb_array_elements(new.answers) a
      join public.audit_checklist_items i on i.id = (a ->> 'item_id')::bigint and i.checklist_id = new.checklist_id
  loop
    v_conta := v_conta + 1;
    if r.result not in ('atende', 'parcial', 'nao_atende', 'nao_aplica') then
      raise exception 'Resposta inválida no checklist.' using errcode = 'check_violation';
    end if;
    if r.result <> 'nao_aplica' then
      v_total := v_total + r.weight;
      v_ganho := v_ganho + r.weight * case r.result when 'atende' then 1 when 'parcial' then 0.5 else 0 end;
    end if;
    if r.eliminatory and r.result = 'nao_atende' then v_elim := true; end if;
  end loop;
  if v_conta <> jsonb_array_length(new.answers) then
    raise exception 'Há resposta de um critério que não pertence ao checklist desta auditoria.' using errcode = 'check_violation';
  end if;
  new.eliminated := v_elim;
  new.score := case when v_elim then 0 when v_total = 0 then null else round(v_ganho / v_total * 100, 1) end;
  return new;
end;
$function$;

-- Checklist já usado numa auditoria: título, peso e eliminatório não mudam (cria-se uma nova versão). Desativar continua permitido.
create function public.audit_items_travar()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  usado boolean;
begin
  select exists (
    select 1 from public.audits a where a.checklist_id = old.checklist_id
  ) into usado;
  if usado then
    if tg_op = 'DELETE' then
      raise exception 'Este checklist já foi usado em auditorias: desative o critério ou crie uma nova versão.' using errcode = 'check_violation';
    elsif new.title is distinct from old.title or new.weight is distinct from old.weight
       or new.eliminatory is distinct from old.eliminatory or new.checklist_id is distinct from old.checklist_id then
      raise exception 'Este checklist já foi usado em auditorias: crie uma nova versão para mudar título, peso ou eliminatório.' using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;

create trigger audits_calcula_nota before insert or update on public.audits for each row execute function public.audits_calcula_nota();
create trigger audit_items_travar before update or delete on public.audit_checklist_items for each row execute function public.audit_items_travar();
create trigger audits_updated_at before update on public.audits for each row execute function public.set_updated_at();
create trigger audit_checklists_updated_at before update on public.audit_checklists for each row execute function public.set_updated_at();
create trigger audit_items_updated_at before update on public.audit_checklist_items for each row execute function public.set_updated_at();
create trigger audit_settings_updated_at before update on public.audit_settings for each row execute function public.set_updated_at();
create trigger audits_attendant_owner before insert or update on public.audits for each row execute function public.check_attendant_owner();

alter table public.audit_settings enable row level security;
alter table public.audit_checklists enable row level security;
alter table public.audit_checklist_items enable row level security;
alter table public.audits enable row level security;

-- A equipe lê; só o administrador configura
create policy "equipe lê" on public.audit_settings as permissive for select to authenticated using (( select is_member() as is_member));
create policy "admin altera" on public.audit_settings as permissive for update to authenticated using (( select is_admin() as is_admin)) with check (( select is_admin() as is_admin));
create policy "equipe lê" on public.audit_checklists as permissive for select to authenticated using (( select is_member() as is_member));
create policy "admin cria" on public.audit_checklists as permissive for insert to authenticated with check (( select is_admin() as is_admin));
create policy "admin edita" on public.audit_checklists as permissive for update to authenticated using (( select is_admin() as is_admin)) with check (( select is_admin() as is_admin));
create policy "admin apaga" on public.audit_checklists as permissive for delete to authenticated using (( select is_admin() as is_admin));
create policy "equipe lê" on public.audit_checklist_items as permissive for select to authenticated using (( select is_member() as is_member));
create policy "admin cria" on public.audit_checklist_items as permissive for insert to authenticated with check (( select is_admin() as is_admin));
create policy "admin edita" on public.audit_checklist_items as permissive for update to authenticated using (( select is_admin() as is_admin)) with check (( select is_admin() as is_admin));
create policy "admin apaga" on public.audit_checklist_items as permissive for delete to authenticated using (( select is_admin() as is_admin));
-- Auditorias: a equipe lê, cria e edita; só o administrador apaga
create policy "equipe lê" on public.audits as permissive for select to authenticated using (( select is_member() as is_member));
create policy "equipe cria" on public.audits as permissive for insert to authenticated with check (( select is_member() as is_member));
create policy "equipe edita" on public.audits as permissive for update to authenticated using (( select is_member() as is_member)) with check (( select is_member() as is_member));
create policy "admin apaga" on public.audits as permissive for delete to authenticated using (( select is_admin() as is_admin));

revoke all on public.audit_settings, public.audit_checklists, public.audit_checklist_items, public.audits from anon, authenticated, service_role;
grant all on public.audit_settings, public.audit_checklists, public.audit_checklist_items, public.audits to authenticated, service_role;

-- Checklist padrão (editável pelo administrador). Pesos somam 100.
insert into public.audit_checklists (id, name, funcao, version, status) values
  (9700000000001, 'Checklist padrão de atendimento', 'Atendente', 1, 'active');
insert into public.audit_checklist_items (id, checklist_id, position, title, hint, weight, eliminatory) values
  (9700000000101, 9700000000001, 1, 'Abertura: saudação e identificação', 'Saudou, identificou-se e identificou a empresa.', 10, false),
  (9700000000102, 9700000000001, 2, 'Confirmação do paciente', 'Nome completo e um dado de segurança.', 15, false),
  (9700000000103, 9700000000001, 3, 'Entendimento da necessidade', 'Ouviu, perguntou o que faltava e resumiu o pedido.', 10, false),
  (9700000000104, 9700000000001, 4, 'Informação correta', 'Exames, preparo, valores, convênio, unidades e horários. Eliminatório: informação errada que pode prejudicar o paciente.', 20, true),
  (9700000000105, 9700000000001, 5, 'Agendamento correto no sistema', 'Exame, data, horário, unidade e convênio certos.', 15, false),
  (9700000000106, 9700000000001, 6, 'Orientação de preparo e documentos', 'Orientou jejum, preparo e documentos necessários.', 10, false),
  (9700000000107, 9700000000001, 7, 'Cordialidade e linguagem', 'Educação e clareza (no WhatsApp, ortografia). Eliminatório: falta de respeito.', 10, true),
  (9700000000108, 9700000000001, 8, 'Registro: tabulação e protocolo informado', 'Tabulou corretamente e informou o protocolo ao paciente.', 5, false),
  (9700000000109, 9700000000001, 9, 'Encerramento', 'Perguntou se havia mais dúvidas e se despediu.', 5, false),
  (9700000000110, 9700000000001, 10, 'Sigilo dos dados do paciente', 'Eliminatório: passar dado do paciente a terceiros. Sem peso: só zera a nota quando falha.', 0, true);
