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
  const { data, error } = await supabaseService().rpc("generate_slots", {
    p_from: addDays(today, 14),
    p_to: addDays(today, 21),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: data, range: [addDays(today, 14), addDays(today, 21)] });
}
