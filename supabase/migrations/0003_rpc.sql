-- 핵심 RPC. 예약/취소/승격의 모든 상태 변경은 여기서 원자적으로 처리한다.
-- Server Action이나 클라이언트에서 "조회 후 인서트" 금지.

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
  -- service_role(Server Action)로 호출되면 auth.uid()가 null이다.
  if auth.uid() is not null and auth.uid() <> p_member_id and not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  -- 1. 슬롯 행 잠금 — 이 잠금이 동시 요청을 직렬화한다 (정원 초과 방어선)
  select * into v_slot from slots where id = p_slot_id for update;
  if not found then raise exception 'SLOT_NOT_FOUND'; end if;
  if v_slot.date < (now() at time zone 'Asia/Seoul')::date then raise exception 'PAST_SLOT'; end if;

  if not exists (select 1 from members where id = p_member_id and is_active) then
    raise exception 'MEMBER_INACTIVE';
  end if;

  select * into v_set from gym_settings where id = 1;
  v_statuses := case when v_set.noshow_counts
                     then array['reserved','attended','noshow']
                     else array['reserved','attended'] end;

  -- 2. 유효 이용권: '오늘'이 아니라 슬롯 날짜 기준 (미래 이용권 선결제 케이스)
  select * into v_mh from membership_histories
   where member_id = p_member_id and v_slot.date between start_date and end_date
   order by end_date desc limit 1;
  if not found then raise exception 'NO_ACTIVE_MEMBERSHIP'; end if;

  -- 3. 1일 1회
  if exists (
    select 1 from reservations r join slots s on s.id = r.slot_id
     where r.member_id = p_member_id and s.date = v_slot.date
       and r.status in ('reserved','attended')
  ) then raise exception 'DAILY_LIMIT'; end if;

  -- 4. 주간 횟수: [해당 주 월~일] ∩ [해당 이용권 기간]. 교차 주간이면 범위가 이용권별로 쪼개진다.
  select count(*) into v_count
    from reservations r join slots s on s.id = r.slot_id
   where r.member_id = p_member_id and r.status = any(v_statuses)
     and s.date >= greatest(date_trunc('week', v_slot.date)::date, v_mh.start_date)
     and s.date <= least(date_trunc('week', v_slot.date)::date + 6, v_mh.end_date);
  if v_count >= v_mh.weekly_limit then raise exception 'WEEKLY_LIMIT'; end if;

  -- 5. 정원 판정
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


create or replace function cancel_reservation(p_reservation_id uuid, p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res      reservations%rowtype;
  v_slot     slots%rowtype;
  v_set      gym_settings%rowtype;
  v_slot_id  uuid;
  v_promoted uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_member_id and not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select slot_id into v_slot_id from reservations where id = p_reservation_id;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;

  -- reserve_slot과 같은 순서(슬롯 먼저)로 잠가 데드락을 피한다
  select * into v_slot from slots where id = v_slot_id for update;
  select * into v_res  from reservations where id = p_reservation_id for update;

  if v_res.member_id <> p_member_id then raise exception 'FORBIDDEN'; end if;
  if v_res.status not in ('reserved', 'waiting') then raise exception 'NOT_CANCELLABLE'; end if;

  -- 패널티: 반드시 Asia/Seoul 기준. UTC로 새면 9시간 어긋난다.
  select * into v_set from gym_settings where id = 1;
  if v_set.penalty_enabled and v_res.status = 'reserved'
     and now() >= ((v_slot.date + v_slot.start_time) at time zone 'Asia/Seoul')
                  - (v_set.penalty_hours || ' hours')::interval
  then raise exception 'PENALTY_LOCKED'; end if;

  update reservations set status = 'cancelled', waiting_order = null where id = v_res.id;

  -- 대기 자동 승격 (트리거가 아니라 여기서 명시적으로)
  if v_res.status = 'reserved' then
    select id into v_promoted from reservations
     where slot_id = v_slot_id and status = 'waiting'
     order by waiting_order, created_at limit 1;
    if v_promoted is not null then
      update reservations set status = 'reserved', waiting_order = null, promoted_at = now()
       where id = v_promoted;
    end if;
  end if;

  -- 남은 대기 순번 1부터 재정렬
  update reservations r set waiting_order = x.rn
    from (select id, row_number() over (order by waiting_order, created_at) rn
            from reservations where slot_id = v_slot_id and status = 'waiting') x
   where r.id = x.id and r.waiting_order is distinct from x.rn;

  return jsonb_build_object('status', 'cancelled', 'promoted_reservation_id', v_promoted);
end;
$$;


-- 멱등. 여러 번 실행해도 unique(date,start_time,coach_name) 덕분에 중복 0건.
create or replace function generate_slots(p_from date, p_to date)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into slots (date, start_time, coach_name, capacity, template_id)
  select d::date, t.start_time, t.coach_name, t.capacity, t.id
    from generate_series(p_from, p_to, '1 day') d
    join slot_templates t
      on t.day_of_week = extract(dow from d)
     and t.is_active
     and d::date >= t.effective_from
     and (t.effective_until is null or d::date <= t.effective_until)
   where d::date not in (select date from closed_dates)
  on conflict (date, start_time, coach_name) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function reserve_slot(uuid, uuid), cancel_reservation(uuid, uuid) to authenticated;
revoke execute on function generate_slots(date, date) from public, anon, authenticated;
