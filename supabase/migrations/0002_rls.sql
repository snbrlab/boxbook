-- RLS: 개인정보 보호는 프론트가 아니라 여기서 강제한다.
-- 회원 세션 = SUPABASE_JWT_SECRET으로 직접 서명한 JWT (sub = members.id, role = authenticated)
--   → auth.uid() = 회원 id
-- 관리자 세션 = Supabase Auth 이메일 로그인 → auth.uid() = admins.id

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where id = auth.uid());
$$;

alter table members              enable row level security;
alter table membership_histories enable row level security;
alter table slot_templates       enable row level security;
alter table closed_dates         enable row level security;
alter table slots                enable row level security;
alter table reservations         enable row level security;
alter table gym_settings         enable row level security;
alter table admins               enable row level security;

-- 회원: 본인 로우만. 관리자: 전부.
create policy members_self on members for select to authenticated using (id = auth.uid() or is_admin());
create policy members_admin on members for all to authenticated using (is_admin()) with check (is_admin());

create policy mh_self on membership_histories for select to authenticated using (member_id = auth.uid() or is_admin());
create policy mh_admin on membership_histories for all to authenticated using (is_admin()) with check (is_admin());

-- 예약: 타인의 로우는 애초에 반환되지 않는다. 회원 화면의 정원/대기 표시는 slot_counts() 집계로만.
create policy res_self on reservations for select to authenticated using (member_id = auth.uid() or is_admin());
create policy res_admin on reservations for all to authenticated using (is_admin()) with check (is_admin());
-- insert/update 정책 없음 = RPC(security definer) 외의 경로로는 쓰기 불가

-- 시간표/슬롯/휴관일/설정: 읽기는 모두, 쓰기는 관리자만
create policy slots_read on slots for select to authenticated using (true);
create policy slots_admin on slots for all to authenticated using (is_admin()) with check (is_admin());
create policy tpl_read on slot_templates for select to authenticated using (true);
create policy tpl_admin on slot_templates for all to authenticated using (is_admin()) with check (is_admin());
create policy closed_read on closed_dates for select to authenticated using (true);
create policy closed_admin on closed_dates for all to authenticated using (is_admin()) with check (is_admin());
create policy settings_read on gym_settings for select to authenticated using (true);
create policy settings_admin on gym_settings for all to authenticated using (is_admin()) with check (is_admin());

create policy admins_self on admins for select to authenticated using (id = auth.uid());

-- 슬롯별 집계. 회원 화면이 타인 예약 로우를 읽지 않고도 [예약/정원][대기자 수]를 얻는 유일한 경로.
create or replace function slot_counts(p_date date)
returns table (slot_id uuid, reserved_count int, waiting_count int)
language sql stable security definer set search_path = public as $$
  select s.id,
         count(*) filter (where r.status = 'reserved')::int,
         count(*) filter (where r.status = 'waiting')::int
    from slots s left join reservations r on r.slot_id = s.id
   where s.date = p_date
   group by s.id;
$$;
grant execute on function slot_counts(date) to authenticated;

-- 실시간 동기화: 예약 로우 자체는 RLS로 못 보므로 postgres_changes를 쓸 수 없다.
-- 대신 개인정보 없는 핑만 날짜별 채널로 broadcast → 클라이언트는 router.refresh()만 한다.
create or replace function notify_slot_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_date date;
begin
  select date into v_date from slots where id = coalesce(new.slot_id, old.slot_id);
  perform realtime.send(jsonb_build_object('date', v_date), 'slot_changed', 'slots:' || v_date, false);
  return null;
end;
$$;
create trigger trg_notify_slot_change
  after insert or update or delete on reservations
  for each row execute function notify_slot_change();
