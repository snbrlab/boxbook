-- 운영시간을 요일별로, 그리고 회원 셀프 출석

-- 운영시간: 요일별 개폐 시각. 텍스트 대신 구조화해 화면에서 요일별로 편집한다.
create table if not exists gym_hours (
  day_of_week int primary key check (day_of_week between 0 and 6),
  open_time   time,
  close_time  time,
  is_closed   boolean not null default false   -- 휴무일
);
-- 7개 요일 행을 미리 만들어 둔다 (편집만 하면 되도록)
insert into gym_hours (day_of_week, open_time, close_time)
select g, '06:00', '23:00' from generate_series(0, 6) g
on conflict (day_of_week) do nothing;

alter table gym_hours enable row level security;
create policy hours_read  on gym_hours for select to authenticated using (true);
create policy hours_admin on gym_hours for all    to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on gym_hours to authenticated;
grant all privileges on gym_hours to service_role;


-- 회원 셀프 출석.
-- 수업 당일, 시작 1시간 전부터 그날 자정까지 본인이 누른다.
-- 누르지 않은 지난 예약은 화면에서 '미출석'으로 보여준다(별도 배치 없이 상태로 판정).
create or replace function check_in(p_reservation_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res  reservations%rowtype;
  v_slot slots%rowtype;
  v_now  timestamp;   -- KST 기준 현재 시각
begin
  select * into v_res from reservations where id = p_reservation_id;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if auth.uid() is not null and auth.uid() <> v_res.member_id and not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if v_res.status = 'attended' then return jsonb_build_object('status', 'attended'); end if;
  if v_res.status <> 'reserved' then raise exception 'NOT_CHECKABLE'; end if;

  select * into v_slot from slots where id = v_res.slot_id;
  v_now := now() at time zone 'Asia/Seoul';

  if v_now::date <> v_slot.date then raise exception 'NOT_TODAY'; end if;
  if v_now < (v_slot.date + v_slot.start_time) - interval '1 hour' then raise exception 'TOO_EARLY'; end if;

  update reservations set status = 'attended' where id = p_reservation_id;
  return jsonb_build_object('status', 'attended');
end;
$$;
grant execute on function check_in(uuid) to authenticated;
