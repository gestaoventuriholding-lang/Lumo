-- Colaborador desligado: terminated_on = ÚLTIMO DIA TRABALHADO (os dados desse dia ainda valem; do dia seguinte em diante, não).
alter table public.attendants
  add column active boolean not null default true,
  add column terminated_on date;

alter table public.attendants add constraint attendants_terminated_check
  check ((active and terminated_on is null) or (not active and terminated_on is not null));
