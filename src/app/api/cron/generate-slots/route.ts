import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/clients";
import { todayKST, addDays } from "@/lib/kst";

// Vercel Cron 주 1회 호출. 항상 ~3주치 슬롯이 미리 차 있도록 today+14 ~ today+21 생성(멱등).
// 즉석 생성 안 함(예약 RPC와 경합). 시크릿으로 보호.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const today = todayKST();
  // 항상 한 달 앞까지 채워둔다 (멱등이라 매주 겹쳐 돌아도 무해)
  const from = today;
  const to = addDays(today, 35);
  const svc = supabaseService();

  const { data: inserted, error } = await svc.rpc("generate_slots", { p_from: from, p_to: to });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 새로 생긴 슬롯에 고정 수업을 자동 예약 (예약 규칙은 reserve_slot이 그대로 검사)
  const { data: reserved, error: rErr } = await svc.rpc("auto_reserve_recurring", { p_from: from, p_to: to });
  if (rErr) return NextResponse.json({ inserted, autoReserveError: rErr.message }, { status: 500 });

  return NextResponse.json({ inserted, autoReserved: reserved, range: [from, to] });
}
