"use client";
import { createClient } from "@supabase/supabase-js";

// 브라우저: Realtime 구독 전용. anon 키만 사용(RLS 적용). 예약 로우는 못 읽고, slot_changed 브로드캐스트만 받는다.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);
