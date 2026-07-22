-- 회원 일괄 예약. "앞으로 4주 화·목 19시"처럼 여러 건을 한 번에 신청한다.
-- 매번 달력을 넘겨가며 하나씩 누르는 건 회원 입장에서 가장 번거로운 일이다.
--
-- 각 건은 reserve_slot을 그대로 거치므로 이용권·1일1회·주간횟수·정원 규칙이 모두 적용된다.
-- 일부가 규칙에 걸려도 나머지는 잡아준다 (전부 실패시키면 쓸모가 없다).
create or replace function bulk_reserve(p_slot_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  v_res      jsonb;
  v_reserved int := 0;
  v_waiting  int := 0;
  v_failed   jsonb := '[]'::jsonb;
  v_slot     slots%rowtype;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;

  -- 날짜순으로 처리해야 주간 한도가 앞 날짜부터 채워진다 (뒤죽박죽이면 결과가 예측 불가)
  for v_id in
    select s.id from slots s where s.id = any(p_slot_ids) order by s.date, s.start_time
  loop
    begin
      v_res := reserve_slot(v_id, auth.uid());
      if v_res->>'status' = 'reserved' then v_reserved := v_reserved + 1;
      else v_waiting := v_waiting + 1;
      end if;
    exception when others then
      select * into v_slot from slots where id = v_id;
      v_failed := v_failed || jsonb_build_object(
        'date', v_slot.date,
        'time', to_char(v_slot.start_time, 'HH24:MI'),
        'reason', sqlerrm
      );
    end;
  end loop;

  return jsonb_build_object('reserved', v_reserved, 'waiting', v_waiting, 'failed', v_failed);
end;
$$;
grant execute on function bulk_reserve(uuid[]) to authenticated;
