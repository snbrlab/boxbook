-- 관리자 화면에서 관리자를 추가/삭제할 수 있게 한다.
-- 기존 admins_self 정책은 '본인 로우만' 조회라 관리자 목록이 안 보였다.
-- is_admin()은 security definer라 RLS를 우회하므로 재귀 문제 없음.

drop policy if exists admins_self on admins;
create policy admins_read on admins for select to authenticated
  using (id = auth.uid() or is_admin());

-- 쓰기는 서버(service_role)에서만. auth.users 생성과 함께 처리해야 하므로
-- authenticated용 insert/delete 정책은 두지 않는다.
