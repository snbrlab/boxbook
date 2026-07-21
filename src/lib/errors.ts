// RPC가 raise하는 문자열 코드 → 회원용 한국어 메시지
const MESSAGES: Record<string, string> = {
  NO_ACTIVE_MEMBERSHIP: "유효한 회원권이 없습니다.",
  DAILY_LIMIT: "이미 오늘 예약한 수업이 있습니다.",
  WEEKLY_LIMIT: "이번 주 예약 가능 횟수를 모두 사용했습니다.",
  PENALTY_LOCKED: "취소 마감 시간이 지나 취소할 수 없습니다.",
  FORBIDDEN: "권한이 없습니다.",
  SLOT_NOT_FOUND: "존재하지 않는 수업입니다.",
  PAST_SLOT: "지난 수업은 예약할 수 없습니다.",
  MEMBER_INACTIVE: "비활성화된 회원입니다.",
  NOT_CANCELLABLE: "취소할 수 없는 예약입니다.",
  RESERVATION_NOT_FOUND: "예약을 찾을 수 없습니다.",
  // 부분 유니크 인덱스 위반
  "23505": "이미 신청한 수업입니다.",
};

export function rpcMessage(err: { message?: string; code?: string } | null): string {
  if (!err) return "알 수 없는 오류가 발생했습니다.";
  const raw = err.message ?? "";
  for (const code in MESSAGES) if (raw.includes(code) || err.code === code) return MESSAGES[code];
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
