-- 테이블 GRANT를 명시한다.
-- RLS는 "어떤 로우를 보는가"를 정하고, GRANT는 "테이블에 접근할 수 있는가"를 정한다.
-- 둘은 별개라 GRANT가 없으면 RLS 이전에 'permission denied for table'로 막힌다.
-- Supabase 기본 권한(default privileges)에 의존하지 않고 여기서 확정한다.

grant usage on schema public to anon, authenticated, service_role;

-- service_role: RLS를 우회하는 서버 전용 역할. 전권 필요.
grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- authenticated: 실제 접근 통제는 RLS 정책이 한다. GRANT는 문을 열어줄 뿐.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- anon: 테이블 접근 불필요 (회원/관리자 모두 authenticated로 동작).
-- 브라우저 클라이언트는 Realtime 구독만 하므로 테이블 권한을 주지 않는다.

-- 앞으로 만들 객체에도 같은 권한이 자동 적용되도록
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
