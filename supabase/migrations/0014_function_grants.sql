-- 자동 예약(고정 수업)이 동작하지 않던 원인.
--
-- 0005에서 "그 시점에 존재하던" 함수만 service_role에 grant했는데,
-- auto_reserve_recurring은 0007에서 새로 만들어지면서 public/anon/authenticated에서 revoke만 했다.
-- 함수 생성 시 EXECUTE는 PUBLIC에 부여되므로, PUBLIC에서 revoke하면 service_role도 못 쓰게 된다.
-- 결과: 슬롯 생성(generate_slots, 0005에 포함됨)은 되는데 자동 예약만 조용히 실패.

grant execute on function auto_reserve_recurring(date, date) to service_role;
grant execute on function generate_slots(date, date) to service_role;

-- 앞으로 만들 함수도 자동으로 커버되게 (0005는 테이블/시퀀스만 다뤘다)
alter default privileges in schema public grant execute on functions to service_role;

-- 현재 존재하는 함수 전체를 한 번 더 맞춰 둔다 (누락 방지)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
