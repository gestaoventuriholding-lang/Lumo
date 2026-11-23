-- Função "Triagem" (gestão): recebe o paciente e transfere para o atendimento. Fica fora dos totais de atendimento.
alter table public.attendants drop constraint attendants_role_check;
alter table public.attendants add constraint attendants_role_check
  check (role = any (array['Atendente','Confirmação de agenda','Triagem']));
