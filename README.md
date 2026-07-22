# 복싱 체육관 예약 시스템

모바일 우선 웹앱. 회원이 수업 세션을 예약하고 관장이 관리한다.
상시 비용 0원 목표 (Vercel Hobby + Supabase Free).

- **Frontend/Host**: Next.js 15 (App Router) + Tailwind + shadcn(base-ui) / Vercel
- **DB/Auth/Realtime**: Supabase (PostgreSQL)
- 예약·취소·대기승격의 모든 상태 변경은 **Postgres RPC 안에서 원자적으로** 처리한다. (`supabase/migrations/0003_rpc.sql`)
- 개인정보 보호는 **RLS로 강제** (`0002_rls.sql`). 회원은 타인 예약 로우를 못 읽고, 집계(`slot_counts`)만 본다.

## 구조

```
supabase/migrations/   0001 스키마 · 0002 RLS/집계/realtime · 0003 RPC · 0004 관리자 RLS
                       0005 GRANT · 0006 서명/규정 · 0007 고정수업/사용량 · 0008 기간집계
                       0009 자율운동/공지 · 0010 슬롯취소·자율운동 제외 · 0011 운영시간/셀프출석
                       0012 공지 이력
supabase/tests/        rpc_checklist.sql (엣지케이스 검증), local_shim.sql (로컬 Postgres용 Supabase 심)
src/lib/               auth(회원 JWT), supabase clients, kst, dow, member/admin 데이터
src/app/               / (회원) · /login · /admin/{,members,schedule,stats,settings} · /api/cron/*
src/app/actions/       member.ts, admin.ts (Server Actions)
```

## 기능

**회원** — 월간 캘린더 예약/대기/취소, 지난 수업 출석 이력, 셀프 출석(당일·시작 1시간 전부터),
주간 사용량(n/N회), 공지사항·운영시간 확인, 다크/라이트 토글, PWA 설치

**관리자** — 타임슬롯 명단(실명·전화)·출석 체크, 회원 등록(이용권+규정 서명 동시)·일괄 등록,
이용권 이력 관리, 고정 수업(정기 예약), 주간 시간표(요일×시간 다중), 휴관일,
자율운동 전환, 슬롯 취소·복구, 공지사항 이력, 요일별 운영시간, 관리자 계정 관리, 통계 대시보드

## 규칙 요약

| 규칙 | 동작 |
|---|---|
| 1일 1회 | 같은 날 수업 1개. **자율운동은 미포함** |
| 주 N회 | 이용권 `weekly_limit`. 범위 = 해당 주 월~일 ∩ 이용권 기간. **자율운동은 미포함** |
| 정원 초과 | 자동 대기 등록, 앞사람 취소 시 자동 승격 |
| 취소 마감 | 수업 시작 N시간 전부터 불가 (KST 기준, 설정에서 조절) |
| 고정 수업 | 슬롯 생성 시 자동 예약. 위 규칙을 그대로 통과해야 함 |
| 슬롯 삭제 | 행을 남기고 취소 표시 — 안 그러면 다음 생성 때 되살아남 |
| 시간표·이용권 변경 | 덮어쓰지 않고 새 로우로 (이력 보존) |

## 로컬 RPC 검증 (UI 없이)

Supabase 없이 순수 Postgres로 핵심 로직을 검증한다:

```bash
createdb gym
psql -d gym -f supabase/tests/local_shim.sql        # auth.uid()/realtime.send() 심
psql -d gym -f supabase/migrations/0001_schema.sql
psql -d gym -f supabase/migrations/0002_rls.sql
psql -d gym -f supabase/migrations/0003_rpc.sql
psql -d gym -f supabase/tests/rpc_checklist.sql       # PASS/FAIL 출력
```

체크: 동시성(정원 초과 0), 중복 거부, 1일 1회, 교차주간, 미래 이용권, 대기 승격+재정렬,
패널티 KST, generate_slots 멱등, 휴관일 제외, 자율운동 횟수 제외, 셀프 출석 시간창.

> `rpc_checklist.sql`의 T5는 스크립트 자체 결함으로 FAIL이 뜬다(한 문장에서 `reserve_slot`을
> 두 번 호출해 문장 전체가 롤백됨). 기능은 정상이며 별도로 확인했다.

## 배포 세팅

1. Supabase 프로젝트 생성 → `supabase/migrations/*.sql`을 **순서대로** SQL 에디터에서 실행 (심 파일은 실행하지 않는다 — 실제 Supabase엔 auth/realtime이 이미 있음).
2. `.env.local.example` → `.env.local` 채우기. `SUPABASE_JWT_SECRET`은 Settings > API > JWT Settings 값.
3. **첫 관리자 만들기**: Supabase Auth에서 이메일/비번으로 유저 생성 후, 그 uid를 admins에 넣는다.
   ```sql
   insert into admins (id, email)
   select id, email from auth.users where email = '관장@example.com';
   ```
4. Vercel에 배포 + 환경변수 등록. `CRON_SECRET`은 Vercel이 Cron 호출 시 Authorization Bearer로 자동 첨부한다.
5. `vercel.json`의 Cron이 주 1회 `generate_slots` + `auto_reserve_recurring` 실행 → 항상 한 달 앞까지 확보.
6. 처음 세팅 순서:
   설정에서 **규정·운영시간** 작성 → **주간 시간표** 채우기 → 타임슬롯의 **[N월 슬롯 채우기]**
   → **회원 등록**(이용권+서명) → 필요하면 **고정 수업** 지정

## 핵심 원칙 (지침서 기준)

- 상태 변경 = RPC only ("조회 후 인서트" 금지)
- 개인정보 = RLS ("프론트에서 이름 숨기기" 금지)
- 슬롯은 템플릿과 독립. 시간표/이용권 변경은 UPDATE 덮어쓰기 없이 새 로우.
- 모든 시각 계산은 `Asia/Seoul`. 예약 제한은 슬롯 날짜 기준.
- 슬롯은 Cron으로 미리 생성 (즉석 생성 금지).

## 결정된 항목 (지침서 9장)

- 노쇼: 주간 횟수에 **포함** (`gym_settings.noshow_counts=true`)
- 내 대기 순번: 슬롯 카드 + 내 예약 탭 **둘 다** 표시
- 테마: 라이트/다크 **토글**
- 관리자 인증: Supabase Auth **이메일 로그인**

## 남은 일

보안 항목을 포함한 백로그는 [PLAN.md](PLAN.md) 참고. **운영 시작 전 PLAN.md의 🔴 항목을 처리할 것.**

## 개발하며 겪은 함정

- **shadcn이 base-ui 기반** — radix가 아니라 `asChild`가 없다. `render` prop을 쓴다.
- **RLS ≠ GRANT** — RLS는 "어떤 행을 보는가", GRANT는 "테이블에 접근 가능한가". GRANT가 없으면
  RLS 이전에 `permission denied for table`로 막힌다. `0005_grants.sql`에서 명시적으로 부여한다.
- **로그인 직후 세션 타이밍** — `signInWithPassword` 바로 다음 줄의 조회는 아직 새 쿠키를 못 읽어
  `anon`으로 나갈 수 있다. 관리자 판정은 `isAdminUser()`가 service_role로 확정한다.
- **에러를 삼키지 말 것** — 집계 RPC 실패를 0으로 처리하면 "정원이 비어있다"는 잘못된 화면이 된다.
  설정 오류와 정상 결과는 반드시 구분해서 드러낸다.
- **슬롯을 지우면 되살아난다** — `generate_slots`가 빈 자리를 다시 채운다. 행을 남기고 취소 표시.
- **로컬 Postgres 검증의 한계** — 슈퍼유저로 테스트하면 RLS/GRANT를 안 거친다.
  권한 관련 문제는 실제 Supabase에서만 드러난다.
