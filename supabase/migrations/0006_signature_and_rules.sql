-- 체육관 규정 + 서명, 그리고 회원 등록 시 함께 받는 정보들.

-- 규정 본문은 단일 로우 설정에 둔다 (버전 관리가 필요해지면 별도 테이블로 승격)
alter table gym_settings add column if not exists rules_text text;

-- 서명: PNG dataURL을 그대로 보관한다.
-- ponytail: Storage 버킷 + 별도 RLS를 세팅하는 대신 컬럼에 넣는다. 서명 이미지는 수십 KB라
-- 회원 수백 명 규모까지는 무료 티어(500MB)에서 문제없다. 그 이상 커지면 Storage로 옮긴다.
alter table members add column if not exists signature   text;
alter table members add column if not exists agreed_at   timestamptz;

-- 뒷자리 로그인 조회를 위한 인덱스 (이름 + 전화 뒤 4자리)
create index if not exists idx_members_name_phone_tail
  on members (name, right(phone, 4));
