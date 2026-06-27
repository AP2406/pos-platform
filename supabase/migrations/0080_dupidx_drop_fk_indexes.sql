-- Go-live hardening P2: duplicate indexes + unindexed foreign keys.

-- duplicate_index: each pair is byte-identical and neither backs a constraint.
-- Keep the UNIQUE idempotency index on orders; keep the original one-open-drawer guard.
drop index if exists public.orders_idem_key_idx;          -- keep orders_business_idem_uniq
drop index if exists public.drawer_sessions_one_open_idx;  -- keep drawer_sessions_one_open

-- unindexed_foreign_keys: add a covering index for every FK column lacking one.
do $$
declare
  r record;
  v_idx text;
begin
  for r in
    select c.conrelid::regclass::text as tbl,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum,ord)
              join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum) as cols,
           (select string_agg(a.attname, '_' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum,ord)
              join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum) as colname
    from pg_constraint c
    where c.contype='f' and c.connamespace='public'::regnamespace
      and not exists (
        select 1 from pg_index i where i.indrelid=c.conrelid and c.conkey[1] = i.indkey[0]
      )
  loop
    v_idx := left(replace(r.tbl, 'public.', '') || '_' || r.colname || '_idx', 63);
    execute format('create index if not exists %I on %s (%s)', v_idx, r.tbl, r.cols);
  end loop;
end $$;
