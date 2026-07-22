-- 날짜별로 slot_counts를 매번 호출하면 날짜를 누를 때마다 서버 왕복이 생긴다.
-- 한 달치를 한 번에 받아 클라이언트에서 날짜만 전환하도록 기간 버전을 둔다.
create or replace function slot_counts_range(p_from date, p_to date)
returns table (slot_id uuid, reserved_count int, waiting_count int)
language sql stable security definer set search_path = public as $$
  select s.id,
         count(*) filter (where r.status in ('reserved','attended','noshow'))::int,
         count(*) filter (where r.status = 'waiting')::int
    from slots s left join reservations r on r.slot_id = s.id
   where s.date between p_from and p_to
   group by s.id;
$$;
grant execute on function slot_counts_range(date, date) to authenticated;
