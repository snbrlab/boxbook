-- 자율운동 슬롯 + 공지사항

-- 특정 슬롯을 코치 수업이 아닌 자율운동 시간으로 전환할 수 있게 한다.
-- 예약 규칙(이용권/1일1회/주간한도/정원)은 수업과 동일하게 적용된다.
alter table slots add column if not exists is_open_gym boolean not null default false;

-- 공지사항: 단일 배너. 여러 건을 쌓아야 할 만큼 자주 쓰이면 별도 테이블로 승격한다.
-- ponytail: 지금 필요한 건 "관장이 한 마디 띄우면 회원이 본다"뿐이다.
alter table gym_settings add column if not exists notice_text text;
alter table gym_settings add column if not exists notice_updated_at timestamptz;

-- 운영시간 안내 (수업 시간표와 별개)
alter table gym_settings add column if not exists hours_text text;
