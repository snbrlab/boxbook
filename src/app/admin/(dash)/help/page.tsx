import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 관장님용 도움말. 외부 문서(Notion/GitHub) 대신 앱 안에 두면
// 헷갈릴 때 그 자리에서 열어볼 수 있고, 기능이 바뀌어도 같이 배포돼 낡지 않는다.
// 원문: docs/관장님_사용설명서.md

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="py-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="pb-4 space-y-2 text-sm leading-relaxed">{children}</CardContent>
    </Card>
  );
}

const Tip = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground rounded bg-muted p-2">{children}</p>
);

export default function HelpPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-lg font-bold">도움말</h1>
        <p className="text-xs text-muted-foreground mt-1">
          매일 하실 건 <b>명단 확인</b>과 <b>출석 체크</b> 두 가지뿐입니다.
        </p>
      </div>

      <Section title="① 매일 — 오늘 명단 보고 출석 체크">
        <p><b>타임슬롯</b> 화면이 첫 화면입니다. 오늘 날짜가 자동으로 열립니다.</p>
        <p>시간대마다 예약자 <b>이름과 전화번호</b>가 보이고, 정원이 차면 대기자가 순서대로 나옵니다.</p>
        <p>수업이 끝나면 이름 옆 <b>[출석]</b> 또는 <b>[노쇼]</b>를 누르세요. 잘못 눌렀으면 다시 눌러 해제됩니다.</p>
        <Tip>회원이 수업 당일 직접 [출석]을 누르기도 합니다. 그러면 관장님은 안 누르셔도 됩니다.</Tip>
        <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
          <li><b>신규</b> 배지 = 등록한 지 7일 이내 회원</li>
          <li>달력의 <b>점(●)</b> = 예약이 있는 날 / <b>흐린 날짜</b> = 수업 없는 날</li>
          <li>지난 날짜도 눌러서 출석 기록을 볼 수 있습니다</li>
        </ul>
      </Section>

      <Section title="② 회원 등록">
        <p><b>회원 → [신규 등록]</b>: 이름·전화번호, 이용권(시작일·종료일·주간 횟수), 규정 서명을 한 번에 받습니다.</p>
        <p>주간 횟수는 주 2회권이면 2, 3회권이면 3을 넣으시면 됩니다.</p>
        <Tip>이용권과 서명은 비워두고 등록해도 됩니다. 나중에 [이용권], [서명받기]로 추가하시면 됩니다.</Tip>
        <p className="pt-1"><b>종이 명부 옮기기</b> — [일괄 등록]에 아래처럼 붙여넣으면 한 번에 등록됩니다.</p>
        <pre className="text-[11px] bg-muted rounded p-2 overflow-x-auto">
{`홍길동,010-1234-5678,2026-07-01,2026-08-01,3,3개월 등록
김철수,010-2222-3333`}
        </pre>
        <p className="text-xs text-muted-foreground">
          <code>이름,전화번호,시작일,종료일,주간횟수,메모</code> 순서. 뒷부분은 생략 가능하고,
          엑셀에서 복사해 붙여넣어도 됩니다. 잘못된 줄만 따로 알려드립니다.
        </p>
      </Section>

      <Section title="③ 회원권 연장 · 고정 수업">
        <p><b>[이용권] → [추가]</b>로 새 기간을 넣습니다.</p>
        <Tip>
          기존 것을 고치지 않고 <b>새로 추가</b>하는 게 맞습니다. 그래야 지난 기록이 남습니다.
          [수정]은 날짜를 <b>잘못 입력했을 때만</b> 쓰세요.
        </Tip>
        <p className="pt-1">
          &quot;화·목 19시 고정&quot; 같은 분은 <b>[고정]</b>에서 요일·시간을 지정해두면 수업이 만들어질 때
          <b> 자동으로 예약</b>됩니다. 일정이 생기면 그날만 취소하고 다른 날로 옮기면 됩니다.
        </p>
        <p className="text-xs text-muted-foreground">
          회원권 만료 <b>7일 이하</b>인 분은 회원 목록에서 빨간색으로 표시됩니다. 재등록 안내하기 좋습니다.
        </p>
      </Section>

      <Section title="④ 수업 취소 (휴강)">
        <p>타임슬롯에서 해당 수업 <b>[취소]</b>를 누르면 세 가지를 물어봅니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>이 수업만</b> — 이번 한 번만 쉬는 경우</li>
          <li><b>이 날 전체</b> — 그날 모든 수업을 안 하는 경우</li>
          <li><b>앞으로 계속</b> — 그 시간 수업을 아예 없애는 경우 (시간표에서도 빠집니다)</li>
        </ul>
        <p>취소하면 그 수업의 예약도 함께 취소됩니다.</p>
        <Tip>실수하셔도 괜찮습니다. 취소된 수업에는 <b>[복구]</b> 버튼이 있습니다.</Tip>
        <p className="pt-1">
          수업 대신 자유 운동 시간으로 바꾸려면 <b>[자율운동으로]</b>를 누르세요.
          자율운동은 <b>주간 횟수에서 차감되지 않습니다.</b>
        </p>
      </Section>

      <Section title="⑤ 주간 시간표">
        <p>매주 반복되는 수업 시간표입니다. 여기서 정한 대로 수업이 만들어집니다.</p>
        <p>코치·정원을 넣고 <b>요일과 시간을 여러 개 선택</b>한 뒤 [추가/변경]을 누릅니다.
          (월·수·금 + 18시·20시 → 6개가 한 번에)</p>
        <p className="pt-1">
          <b>[이 시간표로 맞추기]</b>는 선택한 대로 통째로 맞춥니다.
          월수금 18·19·20시에서 19시를 없애려면 → 월·수·금 + 18시·20시만 선택 → [이 시간표로 맞추기].
          몇 개가 없어지는지 미리 알려드립니다.
        </p>
        <Tip>
          ⚠️ 시간표를 바꿔도 <b>이미 만들어진 수업은 바뀌지 않습니다.</b> 다음에 만들어질 때부터 적용됩니다.
          이미 만들어진 걸 없애려면 타임슬롯에서 취소하세요.
        </Tip>
        <p className="text-xs text-muted-foreground">
          명절이나 쉬는 날은 <b>휴관일</b>로 등록해두면 그날은 수업이 만들어지지 않습니다.
        </p>
      </Section>

      <Section title="⑥ 대시보드 · 설정">
        <p><b>대시보드</b> — 예약 수, 출석률, 요일·시간대별 인기도, 최다 출석 회원, 회원권 만료 임박 명단.</p>
        <p><b>설정</b> — 취소 마감 시간, 노쇼 차감 여부, 체육관 규정, 공지사항, 요일별 운영시간, 관리자 계정.</p>
        <p className="text-xs text-muted-foreground">공지사항을 등록하면 회원 화면 맨 위에 뜹니다. 지난 공지도 보관됩니다.</p>
      </Section>

      <Section title="자주 묻는 것">
        <p><b>회원이 예약이 안 된다고 해요</b></p>
        <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
          <li>회원권이 만료됐거나 (회원 목록에서 확인)</li>
          <li>그 주 횟수를 다 썼거나 (주 2회권인데 이미 2번)</li>
          <li>같은 날 이미 다른 수업을 예약했거나 (하루 1회)</li>
          <li>정원이 차서 대기로 들어갔거나</li>
        </ul>
        <p className="text-xs text-muted-foreground">회원 화면에 이유가 표시됩니다.</p>

        <p className="pt-2"><b>전화번호가 바뀌었어요</b></p>
        <p className="text-xs text-muted-foreground">
          회원 → [수정]에서 바꿔주세요. 그다음부터는 새 번호 뒤 4자리로 로그인합니다.
        </p>

        <p className="pt-2"><b>회원은 어떻게 로그인하나요?</b></p>
        <p className="text-xs text-muted-foreground">이름 + 전화번호 뒤 4자리입니다. 폰을 바꿔도 그대로 됩니다.</p>

        <p className="pt-2"><b>잘못 눌렀어요</b></p>
        <p className="text-xs text-muted-foreground">
          대부분 되돌릴 수 있습니다. 수업 취소는 [복구], 회원 비활성화도 다시 활성화됩니다.
        </p>
      </Section>
    </div>
  );
}
