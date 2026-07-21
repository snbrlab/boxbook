# 복싱 체육관 예약 시스템

모바일 우선 웹앱. 회원이 수업 세션을 예약하고 관장이 관리한다.
상시 비용 0원 목표 (Vercel Hobby + Supabase Free).

- **Frontend/Host**: Next.js 15 (App Router) + Tailwind + shadcn(base-ui) / Vercel
- **DB/Auth/Realtime**: Supabase (PostgreSQL)
- 예약·취소·대기승격의 모든 상태 변경은 **Postgres RPC 안에서 원자적으로** 처리한다. (`supabase/migrations/0003_rpc.sql`)
- 개인정보 보호는 **RLS로 강제** (`0002_rls.sql`). 회원은 타인 예약 로우를 못 읽고, 집계(`slot_counts`)만 본다.

## 구조

```
supabase/migrations/   0001 스키마+제약, 0002 RLS+집계+realtime, 0003 RPC
supabase/tests/        rpc_checklist.sql (엣지케이스 검증), local_shim.sql (로컬 Postgres용 Supabase 심)
src/lib/               auth(회원 JWT), supabase clients, kst, member/admin 데이터
src/app/               / (회원 대시보드), /login, /admin/* , /api/cron/generate-slots
src/app/actions/       member.ts, admin.ts (Server Actions)
```

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

체크: 동시성(정원 초과 0), 중복 거부, 1일 1회, 교차주간, 미래 이용권, 대기 승격+재정렬, 패널티 KST, generate_slots 멱등, 휴관일 제외.

## 배포 세팅

1. Supabase 프로젝트 생성 → `supabase/migrations/*.sql`을 **순서대로** SQL 에디터에서 실행 (심 파일은 실행하지 않는다 — 실제 Supabase엔 auth/realtime이 이미 있음).
2. `.env.local.example` → `.env.local` 채우기. `SUPABASE_JWT_SECRET`은 Settings > API > JWT Settings 값.
3. **첫 관리자 만들기**: Supabase Auth에서 이메일/비번으로 유저 생성 후, 그 uid를 admins에 넣는다.
   ```sql
   insert into admins (id, email)
   select id, email from auth.users where email = '관장@example.com';
   ```
4. Vercel에 배포 + 환경변수 등록. `CRON_SECRET`은 Vercel이 Cron 호출 시 Authorization Bearer로 자동 첨부한다.
5. `vercel.json`의 Cron이 주 1회 `generate_slots(today+14, today+21)` 실행 → 항상 ~3주치 슬롯 확보.
6. 처음엔 관리자 > 주간 시간표에서 템플릿을 채우고, 타임슬롯 화면의 **[슬롯 채우기]**로 즉시 생성.

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

## 미검증 (실 Supabase 필요)

로컬엔 Postgres만 있어 RPC/제약/RLS 로직은 검증했으나, PostgREST·GoTrue·Realtime 연동
(회원 JWT→RLS auth.uid, Realtime broadcast 구독)은 실제 Supabase 프로젝트에서 1회 확인 필요.
