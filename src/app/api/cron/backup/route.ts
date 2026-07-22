import { NextResponse } from "next/server";
import { exportAll } from "@/lib/backup";

// 자동 백업: 백업 JSON을 비공개 GitHub 저장소에 커밋한다.
// Vercel에는 영구 저장소가 없어 파일을 남길 곳이 필요한데, 비공개 repo는 무료이고
// 버전 관리까지 되므로 추가 비용 없이 오프사이트 백업이 된다.
//
// 필요한 환경변수 (없으면 이 라우트는 그냥 건너뛴다):
//   BACKUP_GITHUB_TOKEN       - repo 권한 PAT
//   BACKUP_GITHUB_REPO        - "owner/repo" (반드시 private)
//   BACKUP_INCLUDE_SIGNATURES - "true"면 서명 이미지도 포함 (기본: 제외)
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.BACKUP_GITHUB_TOKEN;
  const repo = process.env.BACKUP_GITHUB_REPO;
  if (!token || !repo) {
    return NextResponse.json({ skipped: "BACKUP_GITHUB_TOKEN/REPO 미설정" });
  }

  const data = await exportAll(process.env.BACKUP_INCLUDE_SIGNATURES === "true");
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const path = `backups/${date}.json`;
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");

  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  // 같은 날 두 번 돌면 덮어써야 하므로 기존 파일의 sha를 먼저 확인한다
  let sha: string | undefined;
  const head = await fetch(api, { headers });
  if (head.ok) sha = (await head.json()).sha;

  const res = await fetch(api, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message: `backup ${date}`, content, sha }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: `GitHub 커밋 실패: ${await res.text()}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, counts: data.counts });
}
