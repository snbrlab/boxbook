"use client";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

// ponytail: 서명 라이브러리 대신 canvas + pointer 이벤트. 필요한 건 '그리고 지우고 dataURL 뽑기'뿐.
export function SignaturePad({ name, required }: { name: string; required?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = useState(true);
  const [value, setValue] = useState("");
  const drawing = useRef(false);

  useEffect(() => {
    const c = canvasRef.current!;
    // 레티나 대응: CSS 크기와 버퍼 크기를 분리
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (empty) setEmpty(false);
  };

  // 획이 끝날 때마다 dataURL을 갱신해 hidden input에 그대로 싣는다 (제출 시점 이벤트에 의존하지 않음)
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setValue(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    setValue("");
  };

  return (
    <div className="space-y-1.5">
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className="w-full h-36 rounded-lg border bg-white touch-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {empty ? (required ? "위 칸에 서명해 주세요" : "서명(선택)") : "서명됨"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={clear}>
          다시 쓰기
        </Button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
