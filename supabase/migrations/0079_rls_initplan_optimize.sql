-- Go-live hardening P2: auth_rls_initplan. Wrap bare auth.*() calls in RLS policy
-- expressions as (select auth.*()) so Postgres evaluates them ONCE per statement
-- instead of once per row. Behavior is identical; this is purely a planner
-- optimization. Applied across all flagged public policies via a loop.

do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') ~* 'auth\.(uid|role|jwt|email)\(\)'
        or coalesce(with_check,'') ~* 'auth\.(uid|role|jwt|email)\(\)')
      and not (coalesce(qual,'') ~* '\(\s*select\s+auth\.'
            or coalesce(with_check,'') ~* '\(\s*select\s+auth\.')
  loop
    v_using := case when r.qual is not null
                    then regexp_replace(r.qual, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g') end;
    v_check := case when r.with_check is not null
                    then regexp_replace(r.with_check, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g') end;
    v_sql := 'alter policy ' || quote_ident(r.policyname) || ' on public.' || quote_ident(r.tablename);
    if v_using is not null then v_sql := v_sql || ' using (' || v_using || ')'; end if;
    if v_check is not null then v_sql := v_sql || ' with check (' || v_check || ')'; end if;
    execute v_sql;
  end loop;
end $$;
