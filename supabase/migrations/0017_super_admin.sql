-- 슈퍼어드민: 관리자 화면에 보이지 않고 삭제할 수 없는 계정.
-- 관장님이 관리자 목록에서 실수로 계정을 지워도 복구할 수 있는 뒷문이 필요하다.
alter table admins add column if not exists is_super boolean not null default false;

-- 슈퍼어드민은 목록 조회에서도 빠진다. RLS에서 걸러야 프론트를 고쳐도 새어나가지 않는다.
drop policy if exists admins_read on admins;
create policy admins_read on admins for select to authenticated
  using ((id = auth.uid() or is_admin()) and not is_super);

-- 삭제는 DB에서 막는다. 앱에 가드를 두더라도 마지막 방어선은 여기여야 한다.
create or replace function protect_super_admin() returns trigger
language plpgsql as $$
begin
  if old.is_super then
    raise exception 'SUPER_ADMIN_PROTECTED';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_super_admin on admins;
create trigger trg_protect_super_admin
  before delete on admins
  for each row execute function protect_super_admin();

-- is_super 플래그 자체를 앱에서 못 바꾸게 (권한 상승/해제 방지)
create or replace function protect_super_flag() returns trigger
language plpgsql as $$
begin
  if new.is_super is distinct from old.is_super then
    raise exception 'SUPER_ADMIN_FLAG_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_super_flag on admins;
create trigger trg_protect_super_flag
  before update on admins
  for each row execute function protect_super_flag();

-- 슈퍼어드민 지정은 SQL 에디터에서만 (앱 경로 없음):
--   update admins set is_super = true where email = '내이메일';
-- 트리거가 update를 막으므로 잠시 끄고 실행한다:
--   alter table admins disable trigger trg_protect_super_flag;
--   update admins set is_super = true where email = '내이메일';
--   alter table admins enable trigger trg_protect_super_flag;
