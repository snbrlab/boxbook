-- 고정 수업(정기 예약): "화·목 19시 고정" 같은 기본 요일을 지정해두면
-- 슬롯이 생성될 때 자동으로 예약된다. 일정이 생기면 그 건만 취소하고 다른 날로 옮기면 된다.

create table if not exists member_recurring_slots (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  day_of_week int  not null check (day_of_week between 0 and 6),
  start_time  time not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists uniq_recurring_active
  on member_recurring_slots (member_id, day_of_week, start_time)
  where is_active;
create index if not exists idx_recurring_member on member_recurring_slots (member_id);

alter table member_recurring_slots enable row level security;
create policy recurring_self on member_recurring_slots for select to authenticated
  using (member_id = auth.uid() or is_admin());
create policy recurring_admin on member_recurring_slots for all to authenticated
  using (is_admin()) with check (is_admin());

grant select, insert, update, delete on member_recurring_slots to authenticated;
grant all privileges on member_recurring_slots to service_role;


-- 지정 기간의 슬롯에 대해 고정 예약을 시도한다.
-- 예약 규칙(이용권/1일1회/주간횟수/정원)은 reserve_slot을 그대로 재사용하므로
-- 고정이라고 해서 제한을 넘지 않는다. 실패(한도 초과, 이미 예약 등)는 조용히 건너뛴다.
create or replace function auto_reserve_recurring(p_from date, p_to date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r        record;
  v_ok     int := 0;
begin
  for r in
    select rs.member_id, s.id as slot_id
      from member_recurring_slots rs
      join slots s
        on extract(dow from s.date) = rs.day_of_week
       and s.start_time = rs.start_time
     where rs.is_active
       and s.date between p_from and p_to
     order by rs.created_at, s.date
  loop
    begin
      perform reserve_slot(r.slot_id, r.member_id);
      v_ok := v_ok + 1;
    exception when others then
      -- 한도 초과·중복·이용권 없음 등은 정상적인 스킵 사유다
      null;
    end;
  end loop;
  return v_ok;
end;
$$;

revoke execute on function auto_reserve_recurring(date, date) from public, anon, authenticated;


-- 회원 화면에 "이번 주 n/N회" 를 보여주기 위한 사용량 조회.
-- 범위 계산은 reserve_slot의 주간 한도 로직과 동일해야 한다(주 월~일 ∩ 이용권 기간).
create or replace function my_weekly_usage(p_date date)
returns table (used int, weekly_limit int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_mh  membership_histories%rowtype;
  v_set gym_settings%rowtype;
  v_statuses text[];
begin
  if auth.uid() is null then return; end if;

  select * into v_mh from membership_histories
   where member_id = auth.uid() and p_date between start_date and end_date
   order by end_date desc limit 1;
  if not found then return; end if;

  select * into v_set from gym_settings where id = 1;
  v_statuses := case when v_set.noshow_counts
                     then array['reserved','attended','noshow']
                     else array['reserved','attended'] end;

  return query
  select count(*)::int, v_mh.weekly_limit
    from reservations r join slots s on s.id = r.slot_id
   where r.member_id = auth.uid() and r.status = any(v_statuses)
     and s.date >= greatest(date_trunc('week', p_date)::date, v_mh.start_date)
     and s.date <= least(date_trunc('week', p_date)::date + 6, v_mh.end_date);
end;
$$;

grant execute on function my_weekly_usage(date) to authenticated;
