-- 공지사항 이력. 단일 배너(gym_settings.notice_text)로는 "지난 공지"를 볼 수 없다.
-- 원칙 4와 같은 방식: 덮어쓰지 않고 새 로우를 쌓는다.
create table if not exists notices (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  is_active  boolean not null default true,   -- 회원 화면 상단 배너 노출 여부
  created_at timestamptz not null default now()
);
create index if not exists idx_notices_created on notices (created_at desc);

alter table notices enable row level security;
create policy notices_read  on notices for select to authenticated using (true);
create policy notices_admin on notices for all    to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on notices to authenticated;
grant all privileges on notices to service_role;

-- 기존 단일 공지를 이력으로 옮긴다
insert into notices (body, is_active, created_at)
select notice_text, true, coalesce(notice_updated_at, now())
  from gym_settings
 where id = 1 and notice_text is not null and btrim(notice_text) <> ''
   and not exists (select 1 from notices);
