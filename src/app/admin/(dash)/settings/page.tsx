import { adminSettings } from "@/lib/admin-data";
import { saveSettings } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const s = await adminSettings();
  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>설정</CardTitle></CardHeader>
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

          <Button type="submit">저장</Button>
        </form>
      </CardContent>
    </Card>
  );
}
