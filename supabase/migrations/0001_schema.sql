-- 복싱 체육관 예약 시스템 — 스키마
-- 제약/인덱스는 처음부터 넣는다 (나중엔 더러운 데이터 때문에 못 넣는다)

create extension if not exists pgcrypto;

create table members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
-- 로그인은 name+phone 대조. 중복 회원 방지 겸 로그인 조회 인덱스.
create unique index uniq_member_name_phone on members (name, phone);

create table membership_histories (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  weekly_limit int  not null check (weekly_limit > 0),
  payment_memo text,
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_mh_member_range on membership_histories (member_id, start_date, end_date);

create table slot_templates (
  id              uuid primary key default gen_random_uuid(),
  day_of_week     int  not null check (day_of_week between 0 and 6), -- 0=일, extract(dow) 기준
  start_time      time not null,
  coach_name      text not null,
  capacity        int  not null check (capacity > 0),
  is_active       boolean not null default true,
  effective_from  date not null default current_date,
  effective_until date,
  created_at      timestamptz not null default now()
);

create table closed_dates (
  date   date primary key,
  reason text
);

create table slots (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  start_time  time not null,
  coach_name  text not null,
  capacity    int  not null check (capacity > 0),
  template_id uuid references slot_templates(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (date, start_time, coach_name) -- 자동 생성 멱등성의 핵심
);
create index idx_slots_date on slots (date);

create table reservations (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references slots(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  status        text not null check (status in ('reserved','waiting','cancelled','noshow','attended')),
  waiting_order int,
  promoted_at   timestamptz,
  created_at    timestamptz not null default now()
);
-- 같은 회원의 같은 슬롯 중복 예약/대기를 DB 레벨에서 원천 차단
create unique index uniq_active_reservation
  on reservations (slot_id, member_id)
  where status in ('reserved','waiting');
create index idx_res_slot on reservations (slot_id);
create index idx_res_member on reservations (member_id);

create table gym_settings (
  id              int primary key check (id = 1),
  penalty_enabled boolean not null default true,
  penalty_hours   int not null default 2,
  noshow_counts   boolean not null default true
);
insert into gym_settings (id) values (1) on conflict do nothing;

-- 관리자: Supabase Auth 이메일 로그인. id = auth.users.id
create table admins (
  id         uuid primary key,
  email      text not null,
  created_at timestamptz not null default now()
);
