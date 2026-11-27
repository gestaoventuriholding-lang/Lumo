-- Ambiente de TESTE (ellos-teste): orçamentos INVENTADOS para a tela de Follow-up, de segunda a sábado, de 02/11 a 26/11/2026.
-- Protocolos fictícios (começam com TESTE) e atendentes inventados do próprio banco de teste. Nada disto vem da Escallo.
delete from public.quote_followups;

with equipe as (
  select id, name, row_number() over (order by id) as n, count(*) over () as total
  from public.attendants where active and service_channel <> 'Ligação'
), base as (
  select d::date as dia, i, (extract(day from d)::int * 7 + i * 5) as semente
  from generate_series('2026-11-02'::date, '2026-11-26'::date, interval '1 day') d, generate_series(1, 9) i
  where extract(dow from d) <> 0
)
insert into public.quote_followups (chat_id, protocol, date, area, attendant_id, attendant_name, status, decline_reason, note, next_contact_on, attempts, last_contact_at, handled_by)
select
  900000000 + to_char(b.dia, 'MMDD')::int * 100 + b.i,
  'TESTE' || to_char(b.dia, 'YYYYMMDD') || lpad(b.i::text, 3, '0'),
  b.dia,
  case when b.semente % 6 = 0 then 'imagem' else 'laboratorio' end,
  e.id, e.name,
  s.status,
  case when s.status = 'declined' then (array['price', 'insurance', 'elsewhere', 'no_answer'])[1 + b.semente % 4] end,
  case when s.status = 'waiting' then 'Anotação inventada: ficou de confirmar o dia.' else '' end,
  case when s.status = 'waiting' then b.dia + 2 + b.semente % 5 end,
  case when s.status = 'pending' then 0 else 1 + b.semente % 2 end,
  case when s.status <> 'pending' then (b.dia + 1)::timestamp + interval '13 hours' end,
  case when s.status <> 'pending' then 'Gestora (inventada)' else '' end
from base b
join equipe e on e.n = 1 + b.semente % e.total
cross join lateral (select case
    when b.dia >= '2026-11-23' then 'pending'
    else (array['pending', 'pending', 'waiting', 'recovered', 'recovered', 'declined', 'already_done', 'pending'])[1 + b.semente % 8]
  end as status) s;
