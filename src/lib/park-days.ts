// Day 1 (2026-09-18, first sighting) .. Day 34 (2026-10-21, 3rd guidance op, back to sea).

export interface OpWindow {
  at: number;
  length: number;
  title: string;
  tool: string;
}

export interface DayConfig {
  day: number;
  date: string; // M/D
  weekday: string;
  title: string;
  note: string;
  crowd: number; // crowd multiplier
  gulls: number;
  ops: OpWindow[];
  final: boolean;
  goal: number;
  tag?: "holiday" | "op" | "news" | "final" | "weekend";
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

interface Special {
  title: string;
  note: string;
  crowd?: number;
  ops?: OpWindow[];
  final?: boolean;
  tag?: DayConfig["tag"];
  gulls?: number;
}

const SPECIAL: Record<string, Special> = {
  "9/18": { title: "첫 출몰", note: "오전 8시 57분, 제5보도교 인근 수로에서 3m 상어 신고", crowd: 0.45, tag: "news" },
  "9/19": { title: "구경꾼 몰려들다", note: "해경이 내보내지 못하자 시민들이 몰려들기 시작", crowd: 0.7, tag: "news" },
  "9/22": { title: "'부캉이' 이름 정착", note: "북항에 나타난 상어라 '부캉이'로 불리기 시작", tag: "news" },
  "9/24": { title: "추석 연휴", note: "추석 연휴, 상어 보러 전국에서 인파", crowd: 1.25, tag: "holiday" },
  "9/25": { title: "추석 연휴", note: "명당 자리 경쟁 치열", crowd: 1.3, tag: "holiday" },
  "9/26": { title: "추석 연휴", note: "스스로 바다로 돌아갈지 지켜보는 중", crowd: 1.3, tag: "holiday" },
  "9/27": { title: "연휴 마지막 날", note: "이른 아침부터 수로를 지키는 시민들", crowd: 1.2, tag: "holiday" },
  "9/29": {
    title: "1차 외해 유도",
    note: "워터펌프로 바다 쪽 유도 시도… 실패",
    tag: "op",
    ops: [
      { at: 22, length: 10, title: "1차 외해 유도 작전", tool: "워터펌프" },
      { at: 55, length: 10, title: "1차 외해 유도 작전", tool: "워터펌프" },
    ],
  },
  "10/2": {
    title: "2차 외해 유도",
    note: "그물로 출구 100m 앞까지 몰아냈지만…",
    tag: "op",
    ops: [
      { at: 20, length: 12, title: "2차 외해 유도 작전", tool: "특수 그물" },
      { at: 55, length: 12, title: "2차 외해 유도 작전", tool: "특수 그물" },
    ],
  },
  "10/3": { title: "그물 넘어 복귀 · 개천절", note: "부캉이가 그물을 넘어 안쪽으로 돌아옴. 개천절 연휴 시작", crowd: 1.25, tag: "holiday" },
  "10/4": { title: "개천절 연휴", note: "사흘간 26만 4천 명 방문", crowd: 1.3, tag: "holiday" },
  "10/5": { title: "개천절 연휴", note: "SNS에 '관종 상어' 영상 폭발", crowd: 1.25, tag: "holiday" },
  "10/6": { title: "흑상어 판명", note: "국립수산과학원, 몸길이 3m 흑상어 암컷으로 확인", tag: "news" },
  "10/9": { title: "한글날 연휴", note: "연휴 첫날 7만 4천 명", crowd: 1.25, tag: "holiday" },
  "10/10": { title: "한글날 연휴", note: "하루 7만 5천 명 방문", crowd: 1.3, tag: "holiday" },
  "10/11": { title: "한글날 연휴", note: "누적 방문객 134만 명 돌파", crowd: 1.2, tag: "holiday" },
  "10/12": { title: "주둥이 상처 발견", note: "수로 벽에 긁힌 듯한 상처… 건강 우려", tag: "news" },
  "10/18": { title: "출몰 한 달째", note: "누적 방문객 150만 명 돌파", crowd: 1.1, tag: "news" },
  "10/20": { title: "3차 작전 대책회의", note: "22일부터 수온 급강하 예보, 다음 날 3차 유도 확정", tag: "news" },
  "10/21": {
    title: "3차 외해 유도 · 작별",
    note: "폰툰과 그물로 출구까지 천천히… 34일 만에 바다로",
    crowd: 1.15,
    tag: "final",
    final: true,
    gulls: 1,
  },
};

function build(): DayConfig[] {
  const out: DayConfig[] = [];
  const start = new Date(2026, 8, 18);
  for (let i = 0; i < 34; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    const wd = d.getDay();
    const sp = SPECIAL[key];
    const weekend = wd === 0 || wd === 6;
    const day = i + 1;
    out.push({
      day,
      date: key,
      weekday: WEEK[wd],
      title: sp?.title ?? (weekend ? "주말 인파" : "평일 직관"),
      note: sp?.note ?? (weekend ? "주말이라 명당이 북적여요" : "출근길·퇴근길 직관러들"),
      crowd: sp?.crowd ?? (weekend ? 1.1 : 0.85),
      gulls: sp?.gulls ?? 2 + (day % 3 === 0 ? 1 : 0),
      ops: sp?.ops ?? [],
      final: sp?.final ?? false,
      // Goals grow with the expected gear progress.
      goal: Math.round((18_000 * Math.pow(1.083, i)) / 1000) * 1000,
      tag: sp?.tag ?? (weekend ? "weekend" : undefined),
    });
  }
  return out;
}

export const DAYS: DayConfig[] = build();

export interface DayProgress {
  cleared: number; // highest cleared day (0 = none)
  best: Record<number, number>;
  ending: boolean;
}

const KEY = "bukangi-days-v1";

export function loadDays(): DayProgress {
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<DayProgress> | null;
    const cleared = typeof p?.cleared === "number" ? Math.max(0, Math.min(34, Math.floor(p.cleared))) : 0;
    const best: Record<number, number> = {};
    if (p?.best && typeof p.best === "object") {
      for (const [k, v] of Object.entries(p.best)) if (typeof v === "number") best[Number(k)] = v;
    }
    return { cleared, best, ending: p?.ending === true };
  } catch {
    return { cleared: 0, best: {}, ending: false };
  }
}

export function saveDays(p: DayProgress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* progress lasts for this session */
  }
}
