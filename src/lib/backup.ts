import { supabaseService } from "@/lib/supabase/service";

// 백업 대상. 슬롯/예약은 재생성 가능하지만, 회원·이용권·출석 이력은 잃으면 복구할 방법이 없다.
const TABLES = [
  "members",
  "membership_histories",
  "member_recurring_slots",
  "slots",
  "reservations",
  "slot_templates",
  "closed_dates",
  "gym_settings",
  "gym_hours",
  "notices",
  "admins",
] as const;

export type Backup = {
  exported_at: string;
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
};

// service_role로 전체를 읽는다. 서버에서만 호출할 것.
// includeSignatures=false면 서명 이미지를 뺀다 — 용량이 크고 가장 민감한 항목이라
// 외부(GitHub 등)로 내보낼 때는 빼는 선택지를 남긴다.
export async function exportAll(includeSignatures = true): Promise<Backup> {
  const svc = supabaseService();
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const t of TABLES) {
    const { data, error } = await svc.from(t).select("*");
    if (error) throw new Error(`${t} 백업 실패: ${error.message}`);
    let rows = data ?? [];
    if (t === "members" && !includeSignatures) {
      rows = rows.map((r: any) => ({ ...r, signature: r.signature ? "[제외됨]" : null }));
    }
    tables[t] = rows;
    counts[t] = rows.length;
  }

  return { exported_at: new Date().toISOString(), tables, counts };
}
