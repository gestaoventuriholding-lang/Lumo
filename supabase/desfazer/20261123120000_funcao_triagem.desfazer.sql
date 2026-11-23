-- Desfaz a função Triagem. Antes, mude quem estiver como Triagem para outra função.
alter table public.attendants drop constraint attendants_role_check;
alter table public.attendants add constraint attendants_role_check
  check (role = any (array['Atendente','Confirmação de agenda']));
