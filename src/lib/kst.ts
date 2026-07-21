// 모든 '오늘' 판정은 Asia/Seoul 기준 (원칙 5). Vercel/서버는 UTC라 여기서 방어.
export function todayKST(): string {
  // en-CA 로케일 → YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}
