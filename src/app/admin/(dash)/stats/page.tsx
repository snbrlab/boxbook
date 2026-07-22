import { adminStats } from "@/lib/admin-data";
import { todayKST, addDays } from "@/lib/kst";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import { WD, DOW_ORDER } from "@/lib/dow";
// 예약은 대부분 '앞으로의 날짜'다. 과거만 세면 실제 예약 현황과 안 맞는다.
// 그래서 기본은 '이번 달'(과거+예정 모두)로 두고, 지난 기간은 별도 선택지로 둔다.
const RANGES = [
  { key: "month", label: "이번 달" },
  { key: "next", label: "다음 달" },
  { key: "30", label: "지난 30일" },
  { key: "90", label: "지난 90일" },
  { key: "all", label: "전체" },
];

function rangeOf(key: string, today: string): { from: string; to: string } {
  const monthStart = (offset: number) => {
    const d = new Date(today.slice(0, 8) + "01T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + offset);
    return d.toISOString().slice(0, 10);
  };
  const monthEnd = (offset: number) => {
    const d = new Date(today.slice(0, 8) + "01T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + offset + 1);
    d.setUTCDate(0);
    return d.toISOString().slice(0, 10);
  };
  switch (key) {
    case "next":  return { from: monthStart(1), to: monthEnd(1) };
    case "30":    return { from: addDays(today, -30), to: today };
    case "90":    return { from: addDays(today, -90), to: today };
    case "all":   return { from: "2000-01-01", to: addDays(today, 365) };
    default:      return { from: monthStart(0), to: monthEnd(0) };
  }
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// 막대는 CSS 폭으로만 그린다 — 차트 라이브러리를 넣을 만큼 복잡하지 않다.
function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-1">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 text-muted-foreground">{d.label}</span>
          <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const rangeKey = (await searchParams).range ?? "month";
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0];
  const today = todayKST();
  const { from, to } = rangeOf(range.key, today);
  const s = await adminStats(from, to);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold">대시보드</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button key={r.key} size="sm" variant={r.key === range.key ? "default" : "ghost"}
              render={<Link href={`/admin/stats?range=${r.key}`} />}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {from === "2000-01-01" ? "전체 기간" : `${from} ~ ${to}`}
        {to > today && " · 예정된 예약 포함"}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="총 예약" value={s.total} sub={`자율운동 ${s.openGym}건 포함`} />
        <Stat label="출석률" value={s.attendRate === null ? "-" : `${s.attendRate}%`} sub={s.attendRate === null ? "출석 기록 없음" : `출석 ${s.attended} / 노쇼 ${s.noshow}`} />
        <Stat label="취소" value={s.cancelled} />
        <Stat label="신규 회원" value={s.newMembers} sub="최근 30일" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="전체 회원" value={s.memberTotal} />
        <Stat label="활성 회원" value={s.memberActive} />
        <Stat label="유효 회원권" value={s.withMembership} />
        <Stat label="곧 만료" value={s.expiringSoon.length} sub="7일 이내" />
      </div>

      {s.expiringSoon.length > 0 && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">회원권 만료 임박</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1 pb-3">
            {s.expiringSoon.map((n) => <Badge key={n} variant="outline" className="text-red-500">{n}</Badge>)}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">요일별 예약</CardTitle></CardHeader>
          <CardContent className="pb-3">
            <Bars data={DOW_ORDER.map((d) => ({ label: WD[d], value: s.byDow[d] }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">시간대별 예약</CardTitle></CardHeader>
          <CardContent className="pb-3">
            {s.byHour.length === 0
              ? <p className="text-xs text-muted-foreground">데이터 없음</p>
              : <Bars data={s.byHour.map(([h, v]) => ({ label: h, value: v }))} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">최다 출석 회원</CardTitle></CardHeader>
        <CardContent className="pb-3">
          {s.topMembers.length === 0
            ? <p className="text-xs text-muted-foreground">데이터 없음</p>
            : <Bars data={s.topMembers.map((m) => ({ label: m.name, value: m.count }))} />}
        </CardContent>
      </Card>
    </div>
  );
}
