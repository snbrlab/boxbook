import { adminSettings, adminList, adminHours, adminNotices } from "@/lib/admin-data";
import { AdminsCard } from "@/components/admin/AdminsCard";
import { HoursCard } from "@/components/admin/HoursCard";
import { NoticesCard } from "@/components/admin/NoticesCard";
import { PurgeCard } from "@/components/admin/PurgeCard";
import { BackupCard } from "@/components/admin/BackupCard";
import { saveSettings } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const [s, { me, admins }, hours, notices] = await Promise.all([
    adminSettings(), adminList(), adminHours(), adminNotices(),
  ]);
  return (
    // items-start: 카드 높이가 제각각이라 서로 늘어나지 않게
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <Card>
        <CardHeader><CardTitle>예약 규칙</CardTitle></CardHeader>
        <CardContent>
          <form action={saveSettings} className="space-y-5">
            <label className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">취소 패널티</div>
                <div className="text-xs text-muted-foreground">켜면 수업 임박 시 취소를 막습니다.</div>
              </div>
              <input type="checkbox" name="penalty_enabled" defaultChecked={s.penalty_enabled} className="h-5 w-5" />
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="ph">취소 마감 (수업 X시간 전)</Label>
              <Input id="ph" type="number" name="penalty_hours" min={0} defaultValue={s.penalty_hours} />
            </div>

            <label className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">노쇼를 주간 횟수에 포함</div>
                <div className="text-xs text-muted-foreground">노쇼도 주간 예약 가능 횟수에서 차감합니다.</div>
              </div>
              <input type="checkbox" name="noshow_counts" defaultChecked={s.noshow_counts} className="h-5 w-5" />
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="rt">체육관 규정</Label>
              <textarea
                id="rt"
                name="rules_text"
                rows={8}
                defaultValue={s.rules_text ?? ""}
                placeholder={"예)\n1. 수업 10분 전까지 입장해 주세요.\n2. 무단 결석이 반복되면 예약이 제한될 수 있습니다."}
                className="w-full rounded-lg border bg-transparent p-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">회원 등록 화면에 표시되고, 서명을 받아 보관합니다.</p>
            </div>

            <Button type="submit">저장</Button>
          </form>
        </CardContent>
      </Card>

      <NoticesCard notices={notices} />
      <HoursCard hours={hours} />
      <AdminsCard me={me} admins={admins} />
      <BackupCard />
      <PurgeCard />
    </div>
  );
}
