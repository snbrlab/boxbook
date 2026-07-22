"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { saveSignature } from "@/app/actions/admin";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Member = { id: string; name: string; signature: string | null; agreed_at: string | null };

// 등록 때 서명을 못 받았거나, 규정이 바뀌어 다시 받아야 할 때.
export function SignatureDialog({ member, rulesText, onClose }: {
  member: Member | null; rulesText: string | null; onClose: () => void;
}) {
  const [busy, start] = useTransition();

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{member?.name} 규정 동의 서명</DialogTitle></DialogHeader>
        {member && (
          <form
            action={(fd) => start(async () => {
              const sig = String(fd.get("signature") ?? "");
              if (!sig) return void toast.error("서명을 입력해 주세요.");
              const r = await saveSignature(member.id, sig);
              if (r?.error) return void toast.error(r.error);
              toast.success("서명을 저장했습니다."); onClose();
            })}
            className="space-y-3"
          >
            {member.signature && (
              <p className="text-xs text-amber-600">
                이미 서명이 있습니다. 새로 받으면 기존 서명을 대체합니다.
              </p>
            )}
            {rulesText ? (
              <div className="max-h-40 overflow-y-auto text-xs whitespace-pre-wrap rounded bg-muted p-2">{rulesText}</div>
            ) : (
              <p className="text-xs text-muted-foreground">규정이 등록되지 않았습니다. 설정 화면에서 먼저 작성하세요.</p>
            )}
            <SignaturePad name="signature" required />
            <DialogFooter><Button type="submit" disabled={busy}>저장</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
