-- 관리자가 회원 대신 예약. 보강(못 온 만큼 다음 주에 하나 더)을 위한 것.
--
-- p_force = false : 회원이 직접 예약한 것과 완전히 동일한 규칙
-- p_force = true  : 1일1회·주간횟수만 건너뛴다 (= 보강)
--                   이용권과 정원은 그대로 지킨다. 정원까지 무시하면 수업이 터진다.
create or replace function admin_reserve_slot(p_slot_id uuid, p_member_id uuid, p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slot     slots%rowtype;
  v_mh       membership_histories%rowtype;
  v_reserved int;
  v_order    int;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  -- 보강이 아니면 일반 예약과 같은 경로를 탄다 (규칙을 두 번 구현하지 않는다)
  if not p_force then
    return reserve_slot(p_slot_id, p_member_id);
  end if;

  select * into v_slot from slots where id = p_slot_id for update;
  if not found then raise exception 'SLOT_NOT_FOUND'; end if;
  if v_slot.is_cancelled then raise exception 'SLOT_CANCELLED'; end if;

  if not exists (select 1 from members where id = p_member_id and is_active) then
    raise exception 'MEMBER_INACTIVE';
  end if;

  -- 이용권은 보강이어도 필요하다. 기간이 안 맞으면 이용권을 먼저 조정해야 한다.
  select * into v_mh from membership_histories
   where member_id = p_member_id and v_slot.date between start_date and end_date
   order by end_date desc limit 1;
  if not found then raise exception 'NO_ACTIVE_MEMBERSHIP'; end if;

  -- 1일1회·주간횟수 건너뜀. 정원은 지킨다.
  select count(*) into v_reserved from reservations where slot_id = p_slot_id and status = 'reserved';
  if v_reserved < v_slot.capacity then
    insert into reservations (slot_id, member_id, status) values (p_slot_id, p_member_id, 'reserved');
    return jsonb_build_object('status', 'reserved', 'forced', true);
  end if;

  select coalesce(max(waiting_order), 0) + 1 into v_order
    from reservations where slot_id = p_slot_id and status = 'waiting';
  insert into reservations (slot_id, member_id, status, waiting_order)
  values (p_slot_id, p_member_id, 'waiting', v_order);
  return jsonb_build_object('status', 'waiting', 'waiting_order', v_order, 'forced', true);
end;
$$;
grant execute on function admin_reserve_slot(uuid, uuid, boolean) to authenticated, service_role;
