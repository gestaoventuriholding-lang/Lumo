-- Ambiente de TESTE (ellos-teste): dados INVENTADOS de filas, espera e abandono, de segunda a sábado, de 14/09 a 17/11/2026.
-- Valores determinísticos (sem aleatório), para os testes e as telas darem sempre o mesmo resultado. Nada disto vem da Escallo.
delete from public.queue_daily;

insert into public.queue_daily (date, channel, area, answered, abandoned, wait_seconds_total)
select d::date, 'Ligação', a.area,
       a.base + (extract(day from d)::int * a.passo) % a.faixa as answered,
       (a.base + (extract(day from d)::int * a.passo) % a.faixa) * a.pct_aband / 100 as abandoned,
       (a.base + (extract(day from d)::int * a.passo) % a.faixa) * (a.espera + (extract(day from d)::int % 4) * 6) as wait_seconds_total
from generate_series('2026-09-14'::date, '2026-11-17'::date, interval '1 day') d,
     (values ('analises', 40, 7, 12, 8, 22), ('imagem', 110, 5, 30, 12, 31), ('cardiologicos', 12, 3, 8, 10, 28), ('outros', 60, 3, 18, 15, 38)) as a(area, base, passo, faixa, pct_aband, espera)
where extract(dow from d) <> 0;

insert into public.queue_daily (date, channel, area, answered, abandoned, wait_seconds_total)
select d::date, 'WhatsApp', 'total',
       230 + (extract(day from d)::int * 11) % 70 as answered,
       0,
       (230 + (extract(day from d)::int * 11) % 70) * (1500 + (extract(day from d)::int % 5) * 240) as wait_seconds_total
from generate_series('2026-09-14'::date, '2026-11-17'::date, interval '1 day') d
where extract(dow from d) <> 0;
