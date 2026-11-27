-- Ellos: Follow-up de orçamentos. Uma linha por conversa do WhatsApp classificada como orçamento na Escallo.
-- A sincronização (chave de serviço) cria as linhas; a equipe só preenche o acompanhamento.
-- LGPD: sem nome, telefone ou mensagem do paciente. O protocolo é o elo com a Escallo.
create table public.quote_followups (
  id bigint generated always as identity primary key,
  chat_id bigint not null unique,                 -- número da conversa na Escallo
  protocol text not null check (length(btrim(protocol)) between 1 and 60),
  date date not null,                             -- dia do pedido de orçamento
  area text not null check (area in ('laboratorio', 'imagem', 'outros')),
  attendant_id bigint references public.attendants (id) on delete set null,
  attendant_name text not null default '',        -- quem fez o orçamento
  status text not null default 'pending' check (status in ('pending', 'waiting', 'recovered', 'already_done', 'declined')),
  decline_reason text check (decline_reason in ('price', 'insurance', 'elsewhere', 'gave_up', 'no_answer', 'not_offered', 'other')),
  note text not null default '' check (length(note) <= 600),
  next_contact_on date,
  attempts integer not null default 0 check (attempts >= 0),
  last_contact_at timestamptz,
  handled_by text not null default '' check (length(handled_by) <= 120),  -- quem da equipe está acompanhando
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- quem não vai fazer precisa ter o motivo
  check (status <> 'declined' or decline_reason is not null)
);

create index quote_followups_date_idx on public.quote_followups (date desc);
create index quote_followups_status_idx on public.quote_followups (status);
create index quote_followups_attendant_idx on public.quote_followups (attendant_id);

create trigger quote_followups_updated_at before update on public.quote_followups for each row execute function public.set_updated_at();

alter table public.quote_followups enable row level security;
revoke all on public.quote_followups from anon;
-- pelo app não se cria nem apaga, e só as colunas do acompanhamento mudam
revoke insert, update, delete, truncate on public.quote_followups from authenticated;
grant select on public.quote_followups to authenticated;
grant update (status, decline_reason, note, next_contact_on, attempts, last_contact_at, handled_by) on public.quote_followups to authenticated;

create policy "equipe lê" on public.quote_followups for select to authenticated using ((select public.is_member()));
create policy "equipe acompanha" on public.quote_followups for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
