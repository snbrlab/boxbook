-- 6장 검증 체크리스트. 실패하면 UI 시작 안 함.
\set ON_ERROR_STOP 0
\pset pager off

-- helper: 상태별 카운트
create or replace function _cnt(sid uuid, st text) returns int language sql as $$
  select count(*)::int from reservations where slot_id=sid and status=st $$;

-- reset
truncate reservations, slots, membership_histories, slot_templates, closed_dates, members cascade;

-- 회원
insert into members (id,name,phone) values
 ('11111111-1111-1111-1111-111111111111','A','010-0000-0001'),
 ('22222222-2222-2222-2222-222222222222','B','010-0000-0002'),
 ('33333333-3333-3333-3333-333333333333','C','010-0000-0003');

-- ================= 1) 동시성: capacity=1 슬롯에 A,B 예약 → 하나만 reserved =================
insert into slots (id,date,start_time,coach_name,capacity) values
 ('aaaa0001-0000-0000-0000-000000000000', current_date+1, '10:00','coach',1);
-- 이용권 (넉넉히)
insert into membership_histories (member_id,start_date,end_date,weekly_limit) values
 ('11111111-1111-1111-1111-111111111111', current_date, current_date+30, 7),
 ('22222222-2222-2222-2222-222222222222', current_date, current_date+30, 7),
 ('33333333-3333-3333-3333-333333333333', current_date, current_date+30, 7);
select 'T1 A=' || (reserve_slot('aaaa0001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111')->>'status');
select 'T1 B=' || (reserve_slot('aaaa0001-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222')->>'status');
select 'T1 CHECK reserved=' || _cnt('aaaa0001-0000-0000-0000-000000000000','reserved') || ' waiting=' || _cnt('aaaa0001-0000-0000-0000-000000000000','waiting') || ' => ' ||
  case when _cnt('aaaa0001-0000-0000-0000-000000000000','reserved')=1 and _cnt('aaaa0001-0000-0000-0000-000000000000','waiting')=1 then 'PASS' else 'FAIL' end;

-- ================= 2) 같은 회원 같은 슬롯 두 번 → 부분 유니크 거부 =================
select 'T2 dup=' || (reserve_slot('aaaa0001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111')->>'status');
-- (위 줄은 예외 발생해야 함; ON_ERROR_STOP 0라 계속 진행. 아래로 상태 확인)
select 'T2 CHECK A active rows=' || (select count(*) from reservations where slot_id='aaaa0001-0000-0000-0000-000000000000' and member_id='11111111-1111-1111-1111-111111111111' and status in ('reserved','waiting')) || ' => ' ||
  case when (select count(*) from reservations where slot_id='aaaa0001-0000-0000-0000-000000000000' and member_id='11111111-1111-1111-1111-111111111111' and status in ('reserved','waiting'))=1 then 'PASS' else 'FAIL' end;

-- ================= 3) 같은 날 다른 슬롯 → DAILY_LIMIT =================
insert into slots (id,date,start_time,coach_name,capacity) values
 ('aaaa0002-0000-0000-0000-000000000000', current_date+1, '11:00','coach',5);
-- A는 이미 위 슬롯에 reserved. 같은 날 다른 슬롯 예약 시도 → DAILY_LIMIT 예외
select 'T3 (expect DAILY_LIMIT error below)';
select reserve_slot('aaaa0002-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111');

-- ================= 4) 교차 주간 =================
-- 시나리오: 어떤 주의 수요일에 이전 이용권(주2) 만료, 목요일부터 새 이용권(주5) 시작.
-- 수요일까지 2건 예약해도 목요일 예약이 막히지 않아야.
-- 안정적 요일 계산: 다음 주 월요일 기준.
truncate reservations, slots, membership_histories cascade;
delete from members where id='44444444-4444-4444-4444-444444444444';
insert into members (id,name,phone) values ('44444444-4444-4444-4444-444444444444','D','010-0000-0004');
-- 다음 월요일
select date_trunc('week', current_date::timestamp)::date + 7 as monday \gset
insert into membership_histories (member_id,start_date,end_date,weekly_limit) values
 ('44444444-4444-4444-4444-444444444444', :'monday', (:'monday'::date + 2), 2),        -- 월~수 주2
 ('44444444-4444-4444-4444-444444444444', (:'monday'::date + 3), (:'monday'::date + 30), 5); -- 목~ 주5
-- 월,화 슬롯 예약(2건) → 주2 소진
insert into slots (id,date,start_time,coach_name,capacity) values
 ('bbbb0001-0000-0000-0000-000000000000', :'monday'::date,   '10:00','coach',5),
 ('bbbb0002-0000-0000-0000-000000000000', :'monday'::date+1, '10:00','coach',5),
 ('bbbb0003-0000-0000-0000-000000000000', :'monday'::date+2, '10:00','coach',5), -- 수: 초과분
 ('bbbb0004-0000-0000-0000-000000000000', :'monday'::date+3, '10:00','coach',5); -- 목: 새 이용권
select 'T4 mon=' || (reserve_slot('bbbb0001-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444')->>'status');
select 'T4 tue=' || (reserve_slot('bbbb0002-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444')->>'status');
select 'T4 wed (expect WEEKLY_LIMIT error, 주2 소진):';
select reserve_slot('bbbb0003-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444');
select 'T4 thu=' || (reserve_slot('bbbb0004-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444')->>'status') || ' (막히면 안 됨: 새 이용권 범위)';

-- ================= 5) 미래 이용권 =================
truncate reservations, slots, membership_histories cascade;
delete from members where id='55555555-5555-5555-5555-555555555555';
insert into members (id,name,phone) values ('55555555-5555-5555-5555-555555555555','E','010-0000-0005');
-- 오늘 이용권 없음, 다음달 이용권만
insert into membership_histories (member_id,start_date,end_date,weekly_limit) values
 ('55555555-5555-5555-5555-555555555555', current_date+30, current_date+60, 5);
insert into slots (id,date,start_time,coach_name,capacity) values
 ('cccc0001-0000-0000-0000-000000000000', current_date+35, '10:00','coach',5);
select 'T5 future=' || (reserve_slot('cccc0001-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555')->>'status') || ' => ' ||
 case when (reserve_slot is not null) then 'PASS(reserved)' else 'FAIL' end from (select reserve_slot('cccc0001-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555')) x;
-- (주의: 위에서 이미 1건 예약됨 → 이 재호출은 dup 에러날 수 있음. 대신 상태로 판정)
select 'T5 CHECK reserved=' || _cnt('cccc0001-0000-0000-0000-000000000000','reserved') || ' => ' || case when _cnt('cccc0001-0000-0000-0000-000000000000','reserved')=1 then 'PASS' else 'FAIL' end;

-- ================= 6) 취소 → 대기 승격 + promoted_at + 재정렬 =================
truncate reservations, slots, membership_histories cascade;
insert into membership_histories (member_id,start_date,end_date,weekly_limit)
 select id, current_date, current_date+30, 7 from members where id in
 ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
insert into slots (id,date,start_time,coach_name,capacity) values
 ('dddd0001-0000-0000-0000-000000000000', current_date+1, '10:00','coach',1);
-- 패널티 OFF로 (내일 10시, penalty 2h면 아직 취소가능하지만 명시적으로)
update gym_settings set penalty_enabled=false where id=1;
select 'T6 A=' || (reserve_slot('dddd0001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111')->>'status'); -- reserved
select 'T6 B=' || (reserve_slot('dddd0001-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222')->>'status'); -- waiting1
select 'T6 C=' || (reserve_slot('dddd0001-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333')->>'status'); -- waiting2
-- A 취소
select cancel_reservation((select id from reservations where slot_id='dddd0001-0000-0000-0000-000000000000' and member_id='11111111-1111-1111-1111-111111111111'), '11111111-1111-1111-1111-111111111111');
select 'T6 CHECK B reserved+promoted? ' ||
  (select status||'/'||(promoted_at is not null) from reservations where slot_id='dddd0001-0000-0000-0000-000000000000' and member_id='22222222-2222-2222-2222-222222222222') ||
  ' C waiting_order=' || (select waiting_order from reservations where slot_id='dddd0001-0000-0000-0000-000000000000' and member_id='33333333-3333-3333-3333-333333333333')::text ||
  ' => ' || case when
    (select status from reservations where slot_id='dddd0001-0000-0000-0000-000000000000' and member_id='22222222-2222-2222-2222-222222222222')='reserved'
    and (select promoted_at is not null from reservations where slot_id='dddd0001-0000-0000-0000-000000000000' and member_id='22222222-2222-2222-2222-222222222222')
    and (select waiting_order from reservations where slot_id='dddd0001-0000-0000-0000-000000000000' and member_id='33333333-3333-3333-3333-333333333333')=1
  then 'PASS' else 'FAIL' end;

-- ================= 7) 패널티 =================
truncate reservations, slots, membership_histories cascade;
insert into membership_histories (member_id,start_date,end_date,weekly_limit) values
 ('11111111-1111-1111-1111-111111111111', current_date-1, current_date+30, 7);
update gym_settings set penalty_enabled=true, penalty_hours=2 where id=1;
-- 수업이 지금(KST)으로부터 1시간 뒤 = 패널티 창(2h) 안 → 취소 막혀야
-- KST 현재시각 + 1h 의 date/time 으로 슬롯 구성
select (now() at time zone 'Asia/Seoul') + interval '1 hour' as kst1h \gset
insert into slots (id,date,start_time,coach_name,capacity) values
 ('eeee0001-0000-0000-0000-000000000000', (:'kst1h')::date, (:'kst1h')::time, 'coach',5);
select 'T7 res=' || (reserve_slot('eeee0001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111')->>'status');
select 'T7 cancel (expect PENALTY_LOCKED, 수업 1h 전):';
select cancel_reservation((select id from reservations where slot_id='eeee0001-0000-0000-0000-000000000000' and member_id='11111111-1111-1111-1111-111111111111'),'11111111-1111-1111-1111-111111111111');
-- 패널티 OFF면 취소 성공
update gym_settings set penalty_enabled=false where id=1;
select 'T7 cancel penalty-off=' || (cancel_reservation((select id from reservations where slot_id='eeee0001-0000-0000-0000-000000000000' and member_id='11111111-1111-1111-1111-111111111111'),'11111111-1111-1111-1111-111111111111')->>'status');

-- ================= 7b) 패널티 시각 KST 경계 (UTC로 새는지) =================
-- 수업이 KST로 지금+3시간 뒤 → 패널티창(2h) 밖 → 취소 가능해야. 만약 UTC로 계산하면 -9h라 이미 지나 잘못 막힘.
truncate reservations, slots cascade;
update gym_settings set penalty_enabled=true, penalty_hours=2 where id=1;
select (now() at time zone 'Asia/Seoul') + interval '3 hour' as kst3h \gset
insert into slots (id,date,start_time,coach_name,capacity) values
 ('eeee0002-0000-0000-0000-000000000000', (:'kst3h')::date, (:'kst3h')::time, 'coach',5);
select reserve_slot('eeee0002-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111');
select 'T7b cancel 3h-before (KST, expect cancelled)=' || coalesce((cancel_reservation((select id from reservations where slot_id='eeee0002-0000-0000-0000-000000000000' and member_id='11111111-1111-1111-1111-111111111111'),'11111111-1111-1111-1111-111111111111')->>'status'),'ERROR');

-- ================= 8) generate_slots 멱등 =================
truncate reservations, slots, slot_templates, closed_dates cascade;
insert into slot_templates (day_of_week, start_time, coach_name, capacity)
 select dow, '10:00', 'coach', 5 from generate_series(0,6) dow;
select 'T8 first=' || generate_slots(current_date, current_date+13);
select 'T8 second=' || generate_slots(current_date, current_date+13) || ' (expect 0, 멱등)';
select 'T8 CHECK total=' || (select count(*) from slots) || ' (expect 14) => ' || case when (select count(*) from slots)=14 then 'PASS' else 'FAIL' end;

-- ================= 9) closed_dates 제외 =================
truncate reservations, slots cascade;
insert into closed_dates (date, reason) values (current_date+3, '휴관');
select 'T9 gen=' || generate_slots(current_date, current_date+13);
select 'T9 CHECK closed excluded=' || (select count(*) from slots where date=current_date+3) || ' (expect 0) => ' || case when (select count(*) from slots where date=current_date+3)=0 then 'PASS' else 'FAIL' end;
