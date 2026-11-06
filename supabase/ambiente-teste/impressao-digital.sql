-- Impressão digital da estrutura (só leitura). Rode no teste e na produção e compare linha a linha.
-- A função disparar_sync_escallo fica de fora: ela aponta para o projeto de cada ambiente, de propósito.
select categoria, count(*) as itens, md5(string_agg(def, '|' order by def)) as digital from (
  select 'colunas' as categoria, c.relname||'.'||a.attname||':'||format_type(a.atttypid, a.atttypmod)||':'||a.attnotnull::text||':'||coalesce(pg_get_expr(d.adbin, d.adrelid), '') as def
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r'
  union all
  select 'restricoes', c.relname||'.'||k.conname||':'||pg_get_constraintdef(k.oid)
  from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
  union all
  select 'indices', pg_get_indexdef(i.indexrelid)
  from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
  union all
  select 'funcoes', pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not in ('disparar_sync_escallo', 'rls_auto_enable')
  union all
  select 'gatilhos', pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and ((n.nspname = 'public') or (n.nspname = 'auth' and t.tgname = 'lumo_grant_admin_on_signup'))
  union all
  select 'politicas', tablename||'|'||policyname||'|'||permissive||'|'||cmd||'|'||array_to_string(roles, ',')||'|'||coalesce(qual, '')||'|'||coalesce(with_check, '')
  from pg_policies where schemaname = 'public'
  union all
  select 'rls', c.relname||':'||c.relrowsecurity::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
  union all
  select 'permissoes_tabelas', c.relname||':'||r.rolname||':'||x.privilege_type
  from pg_class c join pg_namespace n on n.oid = c.relnamespace, aclexplode(c.relacl) x join pg_roles r on r.oid = x.grantee
  where n.nspname = 'public' and c.relkind = 'r' and r.rolname in ('anon', 'authenticated', 'service_role')
  union all
  select 'permissoes_funcoes', p.proname||':'||coalesce((select string_agg(case when a.grantee = 0 then 'PUBLIC' else r.rolname end, ',' order by case when a.grantee = 0 then 'PUBLIC' else r.rolname end)
    from aclexplode(p.proacl) a left join pg_roles r on r.oid = a.grantee where a.privilege_type = 'EXECUTE'), '')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname <> 'rls_auto_enable'
  union all
  select 'realtime', tablename from pg_publication_tables where pubname = 'supabase_realtime'
) t group by categoria order by categoria;
