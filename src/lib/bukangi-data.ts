// Stylised pixel layout of 북항친수공원 (portrait, 180x320 logical pixels).
// The channel wraps the round lawn and runs up toward 부산역; the sea mouth is bottom-left.

export const MAP_W = 180;
export const MAP_H = 320;
export const GAME_SECONDS = 90;

export interface Pt {
  x: number;
  y: number;
}

function buildChannel(): Pt[] {
  const pts: Pt[] = [
    { x: 14, y: 318 },
    { x: 26, y: 298 },
    { x: 40, y: 276 },
  ];
  const cx = 100;
  const cy = 200;
  const r = 66;
  for (let a = 138; a <= 300; a += 6) {
    const rad = (a * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
  }
  pts.push({ x: 146, y: 120 }, { x: 154, y: 96 }, { x: 158, y: 66 }, { x: 160, y: 36 }, { x: 161, y: 12 });
  return pts;
}

export const CHANNEL: Pt[] = buildChannel();
export const LAWN = { x: 100, y: 200, r: 48 };

export interface Bridge {
  name: string;
  s: number;
}

// Footbridges along the channel, measured as a fraction of its length from the sea mouth.
export const BRIDGES: Bridge[] = [
  { name: "제5보도교", s: 0.1 },
  { name: "제4보도교", s: 0.3 },
  { name: "제3보도교", s: 0.52 },
  { name: "제2보도교", s: 0.7 },
  { name: "제1보도교", s: 0.88 },
];

// The packed viewing spot between 제4·제5보도교.
export const HOTSPOT = { from: 0.1, to: 0.3 };
export const CAFE_S = 0.6;

export const COAST_GUARD_OPS = [
  { at: 28, length: 8, title: "1차 외해 유도 작전", tool: "워터펌프" },
  { at: 60, length: 8, title: "2차 외해 유도 작전", tool: "특수 그물" },
];

export interface RankEntry {
  name: string;
  views: number;
  bestShot: string;
  you?: boolean;
}

export const TEAM_RANKING: RankEntry[] = [
  { name: "북항직캠러", views: 418_730, bestShot: "점프 직찍" },
  { name: "초량동산책왕", views: 356_120, bestShot: "작전 현장" },
  { name: "수로지킴이", views: 287_450, bestShot: "점프 직찍" },
  { name: "부산역10번출구", views: 214_980, bestShot: "지느러미 컷" },
  { name: "흑상어덕후", views: 168_340, bestShot: "지느러미 컷" },
  { name: "베이파크브릿지", views: 121_605, bestShot: "수중 실루엣" },
  { name: "관종상어팬", views: 87_215, bestShot: "수중 실루엣" },
  { name: "카페에서충전중", views: 42_870, bestShot: "수중 실루엣" },
];

export function verdict(views: number): string {
  if (views >= 400_000) return "부산시 명예홍보대사급 영상";
  if (views >= 200_000) return "SNS 실시간 트렌드 등극";
  if (views >= 80_000) return "지역 커뮤니티 화제글";
  if (views >= 20_000) return "친구 단톡방 공유 각";
  return "구독자 3명의 소박한 채널";
}

export type DexId = "silhouette" | "fin" | "jump" | "uturn" | "bridge" | "op" | "center" | "combo" | "crowd" | "legend" | "gull" | "ridge" | "teeth" | "chase" | "burst" | "panorama" | "farewell";

export interface DexEntry {
  id: DexId;
  name: string;
  hint: string;
  rarity: "일반" | "희귀" | "전설" | "장비";
  /** Gear-gated legend shots: every requirement must be met to capture it. */
  req?: { gear: "stick" | "powerbank" | "lens" | "shoes"; name: string; lv: number }[];
}

// Legend-shot collection. Conditions are checked in the engine's shoot().
export const DEX: DexEntry[] = [
  { id: "silhouette", name: "수중 실루엣", hint: "물속을 유영하는 부캉이", rarity: "일반" },
  { id: "fin", name: "지느러미 컷", hint: "수면을 가르는 등지느러미", rarity: "일반" },
  { id: "bridge", name: "다리 위 직캠", hint: "보도교 위에서 내려다본 한 컷", rarity: "일반" },
  { id: "crowd", name: "인파 속 한 컷", hint: "붐비는 명당에서 건진 사진", rarity: "일반" },
  { id: "jump", name: "점프 직찍", hint: "물 밖으로 튀어오른 순간", rarity: "희귀" },
  { id: "uturn", name: "출구 앞 유턴", hint: "바다 출구 코앞에서 돌아서는 장면", rarity: "희귀" },
  { id: "center", name: "정중앙 퍼펙트", hint: "프레임 한가운데 정확히", rarity: "희귀" },
  { id: "combo", name: "5연속 성공", hint: "실패 없이 다섯 장 연속", rarity: "희귀" },
  { id: "gull", name: "부기 난입 컷", hint: "부산갈매기 '부기'가 프레임을 점령", rarity: "희귀" },
  { id: "op", name: "작전 실패 현장", hint: "해경 외해 유도 작전 중 포착", rarity: "전설" },
  { id: "legend", name: "전설의 점프 퍼펙트", hint: "점프 순간을 정중앙에", rarity: "전설" },
  { id: "ridge", name: "융기선 판독컷", hint: "지느러미 컷에 흑상어의 등 융기선까지", rarity: "장비", req: [{ gear: "lens", name: "망원렌즈", lv: 8 }] },
  { id: "chase", name: "나란히 질주", hint: "부캉이와 같은 방향으로 달리며 찰칵", rarity: "장비", req: [{ gear: "shoes", name: "러닝화", lv: 12 }] },
  { id: "burst", name: "연사 퍼레이드", hint: "6초 안에 다섯 장 연속 성공", rarity: "장비", req: [{ gear: "powerbank", name: "보조배터리", lv: 12 }] },
  { id: "teeth", name: "톱니 이빨 클로즈업", hint: "점프·지느러미 순간, 삼각형 톱니 이빨이 보일 만큼 정중앙", rarity: "장비", req: [{ gear: "lens", name: "망원렌즈", lv: 15 }] },
  { id: "panorama", name: "인파 파노라마", hint: "붐비는 명당에서 인파와 점프를 한 프레임에", rarity: "장비", req: [{ gear: "stick", name: "셀카봉", lv: 18 }] },
  { id: "farewell", name: "작별 직캠", hint: "Day 34, 바다로 향하는 부캉이의 마지막 모습", rarity: "장비", req: [{ gear: "stick", name: "셀카봉", lv: 10 }, { gear: "lens", name: "망원렌즈", lv: 10 }] },
];

// ---------- equipment shop ----------
export type GearId = "stick" | "powerbank" | "lens" | "shoes";

export interface GearItem {
  id: GearId;
  name: string;
  effect: string;
  // value per level 0..3
  values: number[];
  format: (v: number) => string;
  prices: number[]; // cost to reach level 1, 2, 3
}

export const GEAR_ITEMS: GearItem[] = [
  { id: "stick", name: "셀카봉", effect: "프레임 크기", values: [20, 24, 28, 32], format: (v) => `${Math.round((v / 20) * 100)}%`, prices: [3_000, 8_000, 16_000] },
  { id: "powerbank", name: "보조배터리", effect: "배터리 소모", values: [1, 0.78, 0.58, 0.4], format: (v) => `${Math.round(v * 100)}%`, prices: [2_500, 7_000, 14_000] },
  { id: "lens", name: "망원렌즈", effect: "조회수 배율", values: [1, 1.15, 1.3, 1.5], format: (v) => `×${v.toFixed(2)}`, prices: [4_000, 10_000, 20_000] },
  { id: "shoes", name: "러닝화", effect: "이동 속도", values: [1, 1.12, 1.25, 1.4], format: (v) => `${Math.round(v * 100)}%`, prices: [2_000, 6_000, 12_000] },
];

export type GearLevels = Record<GearId, number>;
export const NO_GEAR: GearLevels = { stick: 0, powerbank: 0, lens: 0, shoes: 0 };

// Views convert to ad revenue (KRW) at the end of each run.
export const revenueFor = (views: number) => Math.floor(views / 20);

// ---------- live comment feed ----------
export const CHAT_NICKS = [
  "초량동주민", "부산갈매기", "상어박사", "북항러버", "관종감별사", "수로뷰맛집", "해운대토박이", "출근길직관", "부캉이엄마", "흑상어덕후",
  "베이파크러너", "역10번출구", "카페알바생", "영도에서왔음", "서울에서KTX", "아쿠아리움직원", "갈매기", "부산시청공식아님",
];

export const CHAT: Record<string, string[]> = {
  idle: [
    "부캉아 얼굴 좀 보여줘", "오늘도 출근 도장 찍으러 옴", "방금 지나간 거 부캉이임?", "와 사람 진짜 많다", "지느러미 보이면 알려주세요",
    "관종 상어 기다리는 중", "여기가 그 명당인가요", "부산역에서 걸어옴ㅋㅋ", "부캉이 오늘 컨디션 어때요", "바다 가라 부캉아… 아니 가지 마",
    "줄 서서 상어 보는 나라", "명예홍보대사님 등장 대기", "흑상어 암컷 3m 실화냐", "배터리 아껴라", "커피 사 들고 대기중",
  ],
  hitSwim: ["오 실루엣 분위기 있다", "물속 그림자 감성", "흐릿한데 그게 또 매력", "이게 부캉이구나"],
  hitFin: ["지느러미 미쳤다", "죠스 BGM 깔아주세요", "등지느러미 각 살아있네", "이거 썸네일각"],
  hitJump: ["???? 점프 실화냐", "와 이걸 찍네", "레전드 갱신", "관종 인정", "조회수 떡상 예약", "소름 돋았다"],
  hitOp: ["작전 현장 단독 포착", "해경 vs 부캉이 2라운드", "뉴스에 나오겠다", "특종이다 특종"],
  miss: ["아 놓쳤다", "물만 찍었네ㅋㅋ", "한 박자 늦었어요", "삼각대 필요할 듯"],
  dive: ["잠수함 모드", "또 숨었다", "부캉이 어디감?", "물결만 남기고 사라짐"],
  jump: ["뛴다뛴다", "점프 떴다!!", "지금이야 찍어!!", "물 밖으로 나왔어"],
  uturn: ["출구 코앞에서 또 유턴ㅋㅋ", "바다 싫어하는 상어", "나갈 생각이 없음", "부캉이: 여기가 내 집"],
  opStart: ["해경 출동했다", "워터펌프 소리 들림", "이번엔 성공할까", "부캉아 버텨"],
  opEnd: ["작전 또 실패ㅋㅋ", "부캉이 승리", "역시 안 나감", "복귀 세리머니 봐라"],
  whistle: ["삐익 소리 났다ㅋㅋ", "안전요원님 고생하십니다", "난간에서 떨어지세요~", "혼났다ㅋㅋ"],
  locked: ["잠깐 쉬어가요", "안전이 최우선"],
  battery: ["배터리 빨간불ㅋㅋ", "카페 가서 충전하세요", "보조배터리 필수"],
  netStart: ["폰툰 들어온다", "이번엔 진짜 가는 거야?", "그물 천천히~", "부캉아 이번엔 나가자"],
  farewell: ["잘가라, 부캉아", "건강하게 돌아가라", "34일 동안 고마웠어", "울컥하네", "바다에서 잘 살아"],
  gull: ["부기 떴다ㅋㅋㅋ", "부산갈매기 등판", "부기야 비켜", "갈매기 vs 상어 직관", "새우깡 없어 부기야"],
  gullAway: ["부기 퇴장ㅋㅋ", "쫓아냄", "부기 삐졌다", "부기 다음에 또 와"],
  gullShot: ["부기 셀카ㅋㅋㅋ", "상어보다 갈매기가 더 잘 나옴", "이것도 컨텐츠", "부기 화보 촬영"],
  dex: ["도감 채우는 맛", "수집욕 자극", "이걸 모으네"],
};
