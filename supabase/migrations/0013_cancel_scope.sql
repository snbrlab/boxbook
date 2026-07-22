-- 슬롯 취소 범위: 이 수업만 / 이 날 전체 / 앞으로 계속.
-- 캘린더 앱들이 반복 일정에 쓰는 방식과 같다. "앞으로 계속"은 미래 슬롯 취소에 더해
-- 원인이 되는 시간표 항목까지 닫아야 한다. 안 그러면 다음 슬롯 생성 때 되살아난다.
--
-- p_scope: 'one' | 'day' | 'future'
create or replace function cancel_slots(p_slot_id uuid, p_scope text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slot     slots%rowtype;
  v_ids      uuid[];
  v_tpl      int := 0;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  select * into v_slot from slots where id = p_slot_id;
  if not found then raise exception 'SLOT_NOT_FOUND'; end if;

  if p_scope = 'one' then
    v_ids := array[v_slot.id];

  elsif p_scope = 'day' then
    select array_agg(id) into v_ids
      from slots where date = v_slot.date and not is_cancelled;

  elsif p_scope = 'future' then
    -- 같은 요일·시간·코치의 오늘(=대상 슬롯 날짜) 이후 슬롯
    select array_agg(id) into v_ids
      from slots
     where not is_cancelled
       and date >= v_slot.date
       and start_time = v_slot.start_time
       and coach_name = v_slot.coach_name
       and extract(dow from date) = extract(dow from v_slot.date);

    -- 재생성의 원인인 시간표 항목을 닫는다
    update slot_templates
       set is_active = false,
           effective_until = (now() at time zone 'Asia/Seoul')::date
     where is_active
       and day_of_week = extract(dow from v_slot.date)
       and start_time = v_slot.start_time
       and coach_name = v_slot.coach_name;
    get diagnostics v_tpl = row_count;

  else
    raise exception 'BAD_SCOPE';
  end if;

  if v_ids is null then v_ids := array[]::uuid[]; end if;

  update slots set is_cancelled = true where id = any(v_ids);

  -- 취소된 슬롯의 살아있는 예약도 함께 취소
  update reservations
     set status = 'cancelled', waiting_order = null
   where slot_id = any(v_ids) and status in ('reserved', 'waiting');

  return jsonb_build_object('slots', coalesce(array_length(v_ids, 1), 0), 'templates', v_tpl);
end;
$$;
grant execute on function cancel_slots(uuid, text) to authenticated;
