-- Canal do cadastro pode ser "Ligação e WhatsApp" (os registros de desempenho continuam em um canal só).
alter table public.attendants drop constraint attendants_service_channel_check;
alter table public.attendants add constraint attendants_service_channel_check
  check (service_channel = any (array['Ligação','WhatsApp','Ligação e WhatsApp']));

update public.attendants set service_channel = 'Ligação e WhatsApp' where escallo_codigo = 1004; -- Ana Lydya
