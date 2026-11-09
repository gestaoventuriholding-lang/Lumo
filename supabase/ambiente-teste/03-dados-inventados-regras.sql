-- Ellos: DADOS INVENTADOS de Regras para o banco de TESTE (projeto ellos-teste). Nada é real.
-- Cobre: assinada por todos, "Faltam X" com assinatura tardia, regra só da Confirmação, regra sem nenhuma assinatura,
-- nova versão (v2 com a v1 arquivada e as assinaturas dela) e desligado que não conta como pendente.
-- Trava: precisa dos colaboradores inventados e recusa rodar se já existir regra.
do $$
declare
  dono uuid;
  atendentes_ativos bigint[] := array[9100000000101, 9100000000102, 9100000000103, 9100000000104, 9100000000105, 9100000000106,
                                      9100000000107, 9100000000108, 9100000000109, 9100000000110, 9100000000111];
  luciano bigint := 9100000000000112; -- desligado (último dia trabalhado há 12 dias)
  sid bigint := 9810000000000;
  a bigint;
begin
  select id into dono from auth.users where lower(email) = 'amanda.silva@venturiholding.com.br';
  if dono is null then raise exception 'Crie o usuário administrador antes.'; end if;
  if not exists (select 1 from public.attendants where id = luciano) then raise exception 'Carregue antes os colaboradores inventados (02-dados-inventados.sql).'; end if;
  if exists (select 1 from public.rules) then raise exception 'Já existem regras: carga recusada.'; end if;

  insert into public.rules (id, owner_id, title, description, category, effective_from, applies_to, status, archived_at, version, previous_id, created_by_email, created_at) values
    (9800000000001, dono, 'Identificação do paciente antes de informar resultados',
      E'Antes de informar qualquer resultado ou dado de exame, confirmar a identidade de quem atende o contato (nome completo e data de nascimento) e registrar a confirmação no atendimento.',
      'Atendimento', current_date - 25, 'all', 'active', null, 1, null, 'amanda.silva@venturiholding.com.br', now() - interval '25 days'),
    (9800000000002, dono, 'Registro obrigatório do protocolo no sistema',
      E'Todo atendimento deve ter o número do protocolo registrado no sistema antes do encerramento. Sem protocolo, o atendimento não pode ser auditado nem localizado depois.',
      'Qualidade', current_date - 10, 'all', 'active', null, 1, null, 'amanda.silva@venturiholding.com.br', now() - interval '10 days'),
    (9800000000003, dono, 'Uso do script de confirmação de consulta',
      E'Na confirmação de agenda, usar o script padrão: identificar-se, confirmar data e horário, orientar preparo e documentos e registrar a confirmação.',
      'Confirmação', current_date - 5, 'Confirmação de agenda', 'active', null, 1, null, 'amanda.silva@venturiholding.com.br', now() - interval '5 days'),
    (9800000000004, dono, 'Pausas somente nos horários permitidos',
      E'As pausas devem ser feitas nos horários combinados com a liderança. Pausa fora do horário precisa de autorização prévia registrada.',
      'Jornada', current_date - 3, 'all', 'active', null, 1, null, 'amanda.silva@venturiholding.com.br', now() - interval '3 days'),
    (9800000000005, dono, 'Atendimento de reclamações',
      E'Versão original: registrar a reclamação e encaminhar ao supervisor em até 1 hora.',
      'Atendimento', current_date - 40, 'all', 'archived', now() - interval '7 days', 1, null, 'amanda.silva@venturiholding.com.br', now() - interval '40 days'),
    (9800000000006, dono, 'Atendimento de reclamações',
      E'Nova versão: registrar a reclamação com protocolo e encaminhar ao supervisor em até 30 minutos. Reclamação de gravidade alta é avisada na hora.',
      'Atendimento', current_date - 7, 'all', 'active', null, 2, 9800000000005, 'amanda.silva@venturiholding.com.br', now() - interval '7 days');

  -- R1: todos os ativos assinaram no treinamento (há 24 dias); o Luciano também (saiu depois e não conta mais como pendente)
  foreach a in array atendentes_ativos || luciano loop
    sid := sid + 1;
    insert into public.rule_signatures (id, rule_id, attendant_id, signed_on, note) values (sid, 9800000000001, a, current_date - 24, 'Treinamento (exemplo)');
  end loop;

  -- R2: treinamento há 9 dias; Elisa e Gisele faltaram e ainda não assinaram; o Fabio assinou depois
  foreach a in array atendentes_ativos loop
    if a in (9100000000105, 9100000000107) then continue; end if;
    sid := sid + 1;
    if a = 9100000000106 then
      insert into public.rule_signatures (id, rule_id, attendant_id, signed_on, note) values (sid, 9800000000002, a, current_date - 6, 'Faltou ao treinamento, assinou depois (exemplo)');
    else
      insert into public.rule_signatures (id, rule_id, attendant_id, signed_on, note) values (sid, 9800000000002, a, current_date - 9, 'Treinamento (exemplo)');
    end if;
  end loop;

  -- R5 (v1 arquivada): assinaturas dela continuam guardadas
  foreach a in array atendentes_ativos loop
    if a in (9100000000110, 9100000000111) then continue; end if;
    sid := sid + 1;
    insert into public.rule_signatures (id, rule_id, attendant_id, signed_on, note) values (sid, 9800000000005, a, current_date - 38, 'Treinamento (exemplo)');
  end loop;
  sid := sid + 1;
  insert into public.rule_signatures (id, rule_id, attendant_id, signed_on, note) values (sid, 9800000000005, luciano, current_date - 38, 'Treinamento (exemplo)');
  -- R3, R4 e R6 (v2) ficam sem nenhuma assinatura de propósito
end $$;
