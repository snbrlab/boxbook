// 요일 표시 규칙: 데이터는 PostgreSQL extract(dow) 기준(0=일)을 그대로 쓰고,
// 화면 순서만 월요일 시작으로 바꾼다. 저장값을 건드리면 기존 데이터가 어긋난다.
export const WD = ["일", "월", "화", "수", "목", "금", "토"];

/** 화면에 나열할 요일 순서 (월~일) */
export const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** 달력에서 이 요일이 몇 번째 칸인지 (월=0 … 일=6) */
export const dowColumn = (dow: number) => (dow + 6) % 7;

/** 주말 색상용 */
export const dowClass = (dow: number) =>
  dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "";
