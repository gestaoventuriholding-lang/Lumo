-- Função do colaborador: Atendente ou Confirmação de agenda (separada do canal).
update public.attendants set role = 'Confirmação de agenda' where escallo_codigo = 1004; -- Ana Lydya

alter table public.attendants add constraint attendants_role_check
  check (role = any (array['Atendente','Confirmação de agenda']));
