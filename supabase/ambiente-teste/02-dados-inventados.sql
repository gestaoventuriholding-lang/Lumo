-- Ellos: DADOS INVENTADOS para o banco de TESTE (projeto ellos-teste). Nenhuma pessoa nem número real.
-- Nomes com "Teste", protocolos "TESTE-xxxx", códigos da Escallo 9001 a 9012, datas relativas a hoje.
-- Trava: recusa rodar se já existir colaborador (a produção tem), então nunca altera dados reais.
do $$
declare
  dono uuid;
  alerta1 date; alerta2 date;
  luciano_id bigint := 9100000000000112;
begin
  select id into dono from auth.users where lower(email) = 'amanda.silva@venturiholding.com.br';
  if dono is null then raise exception 'Crie o usuário administrador no painel antes de carregar os dados.'; end if;
  if exists (select 1 from public.attendants) then raise exception 'Já existem colaboradores: carga recusada (este arquivo é só para o banco de teste vazio).'; end if;
  insert into public.admins (user_id) values (dono) on conflict do nothing;

  -- ---------------------------------------------------------------- configurações (sem dado pessoal)
  insert into public.production_goals (id, owner_id, channel, daily_target, status) values
    (9100000000001, dono, 'Ligação', 70, 'Ativo'),
    (9100000000002, dono, 'WhatsApp', 75, 'Ativo');
  insert into public.working_hours_options (id, owner_id, label) values
    (9100000000011, dono, '6h20'), (9100000000012, dono, '8h'), (9100000000013, dono, '12x36');

  -- ---------------------------------------------------------------- colaboradores inventados
  insert into public.attendants (id, owner_id, name, role, service_channel, working_hours, jornada_start, jornada_end, observation, registration_date, escallo_codigo, active, terminated_on) values
    (9100000000101, dono, 'Alice Teste',   'Atendente',             'Ligação',            '6h20', '06:00', '12:20', 'Dados inventados', current_date - 60, 9001, true,  null),
    (9100000000102, dono, 'Bruno Teste',   'Atendente',             'Ligação',            '6h20', '12:40', '19:00', 'Dados inventados', current_date - 60, 9002, true,  null),
    (9100000000103, dono, 'Carla Teste',   'Atendente',             'Ligação',            '8h',   '08:00', '16:00', 'Dados inventados', current_date - 60, 9003, true,  null),
    (9100000000104, dono, 'Diego Teste',   'Atendente',             'Ligação',            '6h20', '06:00', '12:20', 'Dados inventados', current_date - 60, 9004, true,  null),
    (9100000000105, dono, 'Elisa Teste',   'Atendente',             'WhatsApp',           '6h20', '06:00', '12:20', 'Dados inventados', current_date - 60, 9005, true,  null),
    (9100000000106, dono, 'Fabio Teste',   'Atendente',             'WhatsApp',           '6h20', '12:40', '19:00', 'Dados inventados', current_date - 60, 9006, true,  null),
    (9100000000107, dono, 'Gisele Teste',  'Atendente',             'WhatsApp',           '8h',   '08:00', '16:00', 'Dados inventados', current_date - 60, 9007, true,  null),
    (9100000000108, dono, 'Heitor Teste',  'Atendente',             'WhatsApp',           '6h20', '12:40', '19:00', 'Dados inventados', current_date - 60, 9008, true,  null),
    (9100000000109, dono, 'Iara Teste',    'Atendente',             'Ligação e WhatsApp', '6h20', '06:00', '12:20', 'Atende nos dois canais (inventado)', current_date - 60, 9009, true, null),
    (9100000000110, dono, 'Jonas Teste',   'Atendente',             'WhatsApp',           '6h20', '06:00', '12:20', 'Dados inventados', current_date - 60, 9010, true,  null),
    (9100000000111, dono, 'Karina Teste',  'Confirmação de agenda', 'Ligação e WhatsApp', '6h20', '08:00', '14:20', 'Confirmação de agenda (inventado)', current_date - 60, 9011, true, null),
    (luciano_id,    dono, 'Luciano Teste', 'Atendente',             'Ligação',            '8h',   '08:00', '16:00', 'Desligado (inventado): último dia trabalhado 12 dias atrás', current_date - 60, 9012, false, current_date - 12);

  -- ---------------------------------------------------------------- 30 dias de desempenho e produtividade (dias úteis)
  create temp table _dias on commit drop as
    select d::date as dia, row_number() over (order by d desc) as ordem
    from generate_series(current_date - 30, current_date, interval '1 day') d
    where extract(isodow from d) <= 5;

  create temp table _linhas on commit drop as
  select a.id as attendant_id, a.name, a.role, a.service_channel, a.escallo_codigo, dd.dia, ch.canal,
         -- ruído estável por pessoa/dia/canal
         abs(hashtext(a.id::text || dd.dia::text || ch.canal)) as h,
         abs(hashtext(a.id::text || dd.dia::text)) as h_agente
  from public.attendants a
  cross join _dias dd
  cross join (values ('Ligação'), ('WhatsApp')) as ch(canal)
  where dd.dia <= coalesce(a.terminated_on, current_date)
    and (a.service_channel = 'Ligação e WhatsApp' or a.service_channel = ch.canal);

  create temp table _prod on commit drop as
  select attendant_id, dia, canal, role, h, h_agente,
         case
           when role = 'Confirmação de agenda' and canal = 'Ligação'  then 25 + h % 21
           when role = 'Confirmação de agenda' and canal = 'WhatsApp' then 3 + h % 7
           when canal = 'Ligação'  then 45 + h % 41
           else 50 + h % 46
         end as atend,
         case when canal = 'Ligação' then 2.5 + (h % 26) / 10.0 else 12 + (h % 13) end as tma_min,
         18000 + h_agente % 9000 as login,
         8 + h_agente % 13 as pausa_pct
  from _linhas;

  insert into public.performance_records (id, owner_id, attendant_id, date, channel, attendances_count, average_time_minutes)
  select 9200000000000 + row_number() over (order by attendant_id, dia, canal), dono, attendant_id, dia, canal, atend, round(tma_min::numeric, 2)
  from _prod;

  insert into public.productivity_reports (id, owner_id, attendant_id, period_start, period_end, channel, inbound_count, outbound_count,
    attendances_count, talk_seconds, tma_seconds, login_seconds, pause_seconds, pause_percent, pause_legal_seconds, pause_productive_seconds,
    pause_unproductive_seconds, occupancy_to1, occupancy_to2, occupancy_to3, occupancy_to4, per_hour, report_code, source_file)
  select 9300000000000 + row_number() over (order by attendant_id, dia, canal), dono, attendant_id, dia, dia, canal,
         round(atend * 0.8), atend - round(atend * 0.8), atend,
         round(atend * tma_min * 60), round(tma_min * 60), login,
         round(login * pausa_pct / 100.0), pausa_pct,
         round(login * pausa_pct / 100.0 * 0.6), round(login * pausa_pct / 100.0 * 0.15), round(login * pausa_pct / 100.0 * 0.25),
         55 + h_agente % 34, 56 + h_agente % 34, null, null,
         round((atend / (login / 3600.0))::numeric, 2),
         case when canal = 'Ligação' then 'REL025' else 'REL090' end, 'Dados inventados'
  from _prod;

  -- ---------------------------------------------------------------- alertas de tempo logado (um aberto e um resolvido)
  select dia into alerta1 from _dias where ordem = 3;
  select dia into alerta2 from _dias where ordem = 8;
  insert into public.login_alerts (id, owner_id, attendant_id, alert_date, login_seconds, limit_seconds, status) values
    (9400000000001, dono, 9100000000103, alerta1, 46500, 43200, 'open'),
    (9400000000002, dono, 9100000000106, alerta2, 48200, 43200, 'resolved');
  -- como na regra real: nesses dias, login, pausas, ocupação e chamadas por hora ficam vazios nos dois canais
  update public.productivity_reports set login_seconds = null, pause_seconds = null, pause_percent = null, pause_legal_seconds = null,
    pause_productive_seconds = null, pause_unproductive_seconds = null, occupancy_to1 = null, occupancy_to2 = null, per_hour = null
  where (attendant_id = 9100000000103 and period_start = alerta1) or (attendant_id = 9100000000106 and period_start = alerta2);

  -- ---------------------------------------------------------------- ocorrências, ausências, agenda
  insert into public.incidents (id, owner_id, type, occurred_on, channel, attendant_id, attendant_name, protocol, description, severity, status, action_taken, resolved_at) values
    (9500000000001, dono, 'complaint',            current_date - 2,  'Ligação',  9100000000101, 'Alice Teste',  'TESTE-0001', 'Cliente fictício reclamou da espera (exemplo de teste).', 'medium', 'open', '', null),
    (9500000000002, dono, 'scheduling_error',     current_date - 5,  'WhatsApp', 9100000000105, 'Elisa Teste',  'TESTE-0002', 'Horário agendado no dia errado (exemplo de teste).', 'high', 'in_progress', '', null),
    (9500000000003, dono, 'incorrect_scheduling', current_date - 9,  'Ligação',  9100000000102, 'Bruno Teste',  'TESTE-0003', 'Exame marcado na unidade errada (exemplo de teste).', 'low', 'resolved', 'Agendamento corrigido e cliente avisado (exemplo).', now() - interval '6 days'),
    (9500000000004, dono, 'complaint',            current_date - 12, 'WhatsApp', luciano_id,    'Luciano Teste','TESTE-0004', 'Demora na resposta (exemplo de teste).', 'low', 'resolved', 'Orientação registrada (exemplo).', now() - interval '10 days');
  insert into public.absences (id, owner_id, attendant_id, type, start_date, end_date, reason, status) values
    (9600000000001, dono, 9100000000102, 'vacation', current_date + 7, current_date + 16, 'Férias (exemplo)', 'approved'),
    (9600000000002, dono, 9100000000104, 'sick', current_date - 6, current_date - 4, 'Atestado (exemplo)', 'approved');
  insert into public.calendar_events (id, owner_id, title, type, date, start_time, end_time, description) values
    (9700000000001, dono, 'Reunião de equipe (exemplo)', 'meeting', current_date + 2, '10:00', '11:00', 'Evento inventado para o ambiente de teste'),
    (9700000000002, dono, 'Treinamento de WhatsApp (exemplo)', 'event', current_date + 5, '14:00', '15:30', 'Evento inventado para o ambiente de teste'),
    (9700000000003, dono, 'Conferir escala (exemplo)', 'reminder', current_date + 1, null, null, 'Lembrete inventado');

  -- ---------------------------------------------------------------- execuções de sincronização de exemplo (nenhuma é real)
  insert into public.sync_runs (mode, triggered_by, days, started_at, finished_at, status, rel025_agents, rel090_agents, rows_inserted, rows_updated,
    rows_skipped_manual, login_blanked, alerts_created, unlinked_with_activity, duration_ms, ignored_terminated, warnings) values
    ('manual', 'pessoa', array[current_date - 1], now() - interval '26 hours', now() - interval '26 hours' + interval '2 seconds', 'ok', 6, 6, 18, 0, 0, 0, 0, 3, 2100, 0, '[]'::jsonb),
    ('manual', 'pessoa', array[current_date],     now() - interval '2 hours',  now() - interval '2 hours' + interval '1 second',  'ok', 6, 6, 0, 18, 0, 0, 0, 3, 1500, 2,
      jsonb_build_array(jsonb_build_object('tipo', 'desligado', 'colaborador_id', luciano_id, 'nome', 'Luciano Teste', 'dia', current_date, 'canal', 'Ligação', 'atendimentos', 14, 'terminated_on', current_date - 12),
                        jsonb_build_object('tipo', 'desligado', 'colaborador_id', luciano_id, 'nome', 'Luciano Teste', 'dia', current_date, 'canal', 'WhatsApp', 'atendimentos', 6, 'terminated_on', current_date - 12)));
end $$;
