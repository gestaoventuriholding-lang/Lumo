-- Ellos: DADOS INVENTADOS de Auditoria para o banco de TESTE (projeto ellos-teste). Nada é real; protocolos são fictícios.
-- Cobre: notas altas e baixas (2 colaboradores ficam abaixo de 85), uma auditoria eliminatória, "Não se aplica", feedback dado e pendente,
-- ligação e WhatsApp, meses diferentes e um colaborador sem nenhuma auditoria.
-- Trava: precisa dos colaboradores inventados e do checklist padrão, e recusa rodar se já existir auditoria.
do $$
declare
  dono uuid;
  ativos bigint[] := array[9100000000101, 9100000000102, 9100000000103, 9100000000104, 9100000000105, 9100000000106,
                           9100000000107, 9100000000108, 9100000000109, 9100000000110];
  itens bigint[] := array[9700000000101, 9700000000102, 9700000000103, 9700000000104, 9700000000105,
                          9700000000106, 9700000000107, 9700000000108, 9700000000109, 9700000000110];
  fracos bigint[] := array[9100000000104, 9100000000107];
  n integer := 24;
  i integer;
  j integer;
  colab bigint;
  dia date;
  resp jsonb;
  r text;
  v integer;
  pontos text[];
begin
  select id into dono from auth.users where lower(email) = 'amanda.silva@venturiholding.com.br';
  if dono is null then raise exception 'Crie o usuário administrador antes.'; end if;
  if not exists (select 1 from public.attendants where id = 9100000000101) then raise exception 'Carregue antes os colaboradores inventados (02-dados-inventados.sql).'; end if;
  if not exists (select 1 from public.audit_checklist_items where id = 9700000000101) then raise exception 'Aplique antes a migração de auditoria (checklist padrão).'; end if;
  if exists (select 1 from public.audits) then raise exception 'Já existem auditorias: carga recusada.'; end if;

  for i in 1..n loop
    -- o último colaborador (9100000000110) fica sem auditoria; os dois fracos recebem mais
    colab := case when i <= 6 then fracos[(i % 2) + 1] else ativos[((i * 5) % 9) + 1] end;
    dia := current_date - ((i * 5) % 58);
    resp := '[]'::jsonb;
    for j in 1..10 loop
      v := (i * 7 + j * 3) % 10;
      if colab = any (fracos) then v := least(9, v + 3); end if;
      r := case when v <= 5 then 'atende' when v <= 7 then 'parcial' when v = 8 then 'nao_atende' else 'nao_aplica' end;
      -- eliminatórios (informação correta, cordialidade, sigilo) só falham na auditoria 3
      if j in (4, 7, 10) then r := case when i = 3 and j = 4 then 'nao_atende' else 'atende' end; end if;
      -- abertura e confirmação nunca ficam "não se aplica"
      if j in (1, 2) and r = 'nao_aplica' then r := 'atende'; end if;
      resp := resp || jsonb_build_array(jsonb_build_object('item_id', itens[j], 'result', r,
        'note', case when r = 'nao_atende' then 'Não fez este passo (exemplo inventado).' else '' end));
    end loop;

    insert into public.audits (id, owner_id, attendant_id, checklist_id, channel, attended_on, protocol, answers, general_note, feedback,
                               feedback_given_on, ack_mode, ack_at, auditor_email, created_at)
    values (9900000000000 + i, dono, colab, 9700000000001, case when i % 3 = 0 then 'Ligação' else 'WhatsApp' end, dia,
            'TESTE-AUD-' || lpad(i::text, 3, '0'), resp,
            case when i % 4 = 0 then 'Bom atendimento, com pequenos ajustes (exemplo inventado).' else '' end,
            case when i % 2 = 0 then 'Pontos fortes: cordialidade. Melhorar: confirmar sempre o dado de segurança (exemplo inventado).' else '' end,
            case when i % 2 = 0 and i < 18 then dia + 2 else null end,
            case when i % 2 = 0 and i < 18 then 'supervisora' else null end,
            case when i % 2 = 0 and i < 18 then (dia + 2)::timestamptz else null end,
            'amanda.silva@venturiholding.com.br', now() - ((i % 40) || ' days')::interval);
  end loop;
end $$;
