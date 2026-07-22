-- 슬롯 삭제가 되살아나는 문제.
-- 행을 지우면 unique(date,start_time,coach_name)가 비어 generate_slots가 같은 슬롯을 다시 만든다.
-- 행을 남기고 취소 표시만 하면 유니크 제약이 재생성을 막아준다 (on conflict do nothing).
-- 삭제 이력도 남고, 실수로 지웠을 때 복구도 가능하다.
alter table slots add column if not exists is_cancelled boolean not null default false;
create index if not exists idx_slots_active on slots (date) where not is_cancelled;

-- 고정 수업 자동 예약이 취소된 슬롯을 잡지 않도록
create or replace function auto_reserve_recurring(p_from date, p_to date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r    record;
  v_ok int := 0;
begin
  for r in
    select rs.member_id, s.id as slot_id
      from member_recurring_slots rs
      join slots s
        on extract(dow from s.date) = rs.day_of_week
       and s.start_time = rs.start_time
     where rs.is_active
       and not s.is_cancelled
       and s.date between p_from and p_to
     order by rs.created_at, s.date
  loop
    begin
      perform reserve_slot(r.slot_id, r.member_id);
      v_ok := v_ok + 1;
    exception when others then
      null;
    end;
  end loop;
  return v_ok;
end;
$$;
revoke execute on function auto_reserve_recurring(date, date) from public, anon, authenticated;

-- 취소된 슬롯은 예약할 수 없다
create or replace function reserve_slot(p_slot_id uuid, p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slot     slots%rowtype;
  v_mh       membership_histories%rowtype;
  v_set      gym_settings%rowtype;
  v_statuses text[];
  v_count    int;
  v_reserved int;
  v_order    int;
begin
  if auth.uid() is not null and auth.uid() <> p_member_id and not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_slot from slots where id = p_slot_id for update;
  if not found then raise exception 'SLOT_NOT_FOUND'; end if;
  if v_slot.is_cancelled then raise exception 'SLOT_CANCELLED'; end if;
  if v_slot.date < (now() at time zone 'Asia/Seoul')::date then raise exception 'PAST_SLOT'; end if;

  if not exists (select 1 from members where id = p_member_id and is_active) then
    raise exception 'MEMBER_INACTIVE';
  end if;

  select * into v_set from gym_settings where id = 1;
  v_statuses := case when v_set.noshow_counts
                     then array['reserved','attended','noshow']
                     else array['reserved','attended'] end;

  select * into v_mh from membership_histories
   where member_id = p_member_id and v_slot.date between start_date and end_date
   order by end_date desc limit 1;
  if not found then raise exception 'NO_ACTIVE_MEMBERSHIP'; end if;

  -- 자율운동은 수업이 아니므로 1일1회·주간횟수에 포함하지 않는다.
  -- 자율운동을 예약하는 경우도, 이미 잡힌 자율운동도 카운트에서 제외한다.
  if not v_slot.is_open_gym and exists (
    select 1 from reservations r join slots s on s.id = r.slot_id
     where r.member_id = p_member_id and s.date = v_slot.date
       and not s.is_open_gym
       and r.status in ('reserved','attended')
  ) then raise exception 'DAILY_LIMIT'; end if;

  if not v_slot.is_open_gym then
    select count(*) into v_count
      from reservations r join slots s on s.id = r.slot_id
     where r.member_id = p_member_id and r.status = any(v_statuses)
       and not s.is_open_gym
       and s.date >= greatest(date_trunc('week', v_slot.date)::date, v_mh.start_date)
       and s.date <= least(date_trunc('week', v_slot.date)::date + 6, v_mh.end_date);
    if v_count >= v_mh.weekly_limit then raise exception 'WEEKLY_LIMIT'; end if;
  end if;

  select count(*) into v_reserved from reservations where slot_id = p_slot_id and status = 'reserved';
  if v_reserved < v_slot.capacity then
    insert into reservations (slot_id, member_id, status) values (p_slot_id, p_member_id, 'reserved');
    return jsonb_build_object('status', 'reserved');
  end if;

  select coalesce(max(waiting_order), 0) + 1 into v_order
    from reservations where slot_id = p_slot_id and status = 'waiting';
  insert into reservations (slot_id, member_id, status, waiting_order)
  values (p_slot_id, p_member_id, 'waiting', v_order);
  return jsonb_build_object('status', 'waiting', 'waiting_order', v_order);
end;
$$;
grant execute on function reserve_slot(uuid, uuid) to authenticated;


-- 사용량 표시도 같은 기준(자율운동 제외)이어야 화면과 실제 판정이 어긋나지 않는다
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
     and not s.is_open_gym
     and s.date >= greatest(date_trunc('week', p_date)::date, v_mh.start_date)
     and s.date <= least(date_trunc('week', p_date)::date + 6, v_mh.end_date);
end;
$$;
grant execute on function my_weekly_usage(date) to authenticated;
