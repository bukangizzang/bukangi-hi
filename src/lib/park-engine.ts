import {
  BRIDGES,
  CAFE_S,
  CHANNEL,
  GAME_SECONDS,
  HOTSPOT,
  LAWN,
  MAP_H,
  type DexId,
  MAP_W,
  type Pt,
} from "@/lib/bukangi-data";
import type { DayConfig, OpWindow } from "@/lib/park-days";

// ---------- channel geometry ----------
const cum: number[] = [0];
for (let i = 1; i < CHANNEL.length; i++) {
  const a = CHANNEL[i - 1];
  const b = CHANNEL[i];
  cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
}
export const CHANNEL_LEN = cum[cum.length - 1];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface Frame extends Pt {
  tx: number;
  ty: number;
  nx: number;
  ny: number;
}

export function channelAt(s: number): Frame {
  const d = clamp(s, 0, 1) * CHANNEL_LEN;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = CHANNEL[i - 1];
  const b = CHANNEL[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const f = (d - cum[i - 1]) / seg;
  const tx = (b.x - a.x) / seg;
  const ty = (b.y - a.y) / seg;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tx, ty, nx: ty, ny: -tx };
}

export function promenadeAt(s: number, extra = 0): Pt {
  const c = channelAt(s);
  return { x: c.x + c.nx * (13 + extra), y: c.y + c.ny * (13 + extra) };
}

const PROM_SAMPLES = Array.from({ length: 241 }, (_, i) => {
  const s = i / 240;
  return { s, ...promenadeAt(s) };
});

export function nearestPromenadeS(x: number, y: number): number {
  let best = PROM_SAMPLES[0];
  let bd = Infinity;
  for (const p of PROM_SAMPLES) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return clamp(best.s, 0.02, 0.99);
}

// ---------- game state ----------
export type SharkState = "swim" | "fin" | "dive" | "jump";
export type Tone = "hit" | "miss" | "warn" | "info";

export type EventKind = "farewell" | "netStart" | "gull" | "gullAway" | "gullShot" | "jump" | "uturn" | "opStart" | "opEnd" | "whistle" | "locked" | "battery" | "miss" | "dive" | "hitSwim" | "hitFin" | "hitJump" | "hitOp";

export interface GameEvent {
  text: string;
  tone: Tone;
  kind?: EventKind;
}

interface Person {
  s: number;
  off: number;
  color: string;
  phase: number;
}

export interface Gear {
  frame: number;
  drain: number;
  lens: number;
  speed: number;
  levels?: Partial<Record<"stick" | "powerbank" | "lens" | "shoes", number>>;
}

export const BASE_GEAR: Gear = { frame: 20, drain: 1, lens: 1, speed: 1 };

export interface Game {
  gear: Gear;
  gull: { phase: "none" | "in" | "perch" | "out"; t0: number; shake: number; x: number; y: number; times: number[] };
  /** Slide-pad input, -1 (toward the sea) .. 1 (toward 부산역). */
  steer: number;
  t: number;
  ps: number;
  target: number;
  still: number;
  lockUntil: number;
  guardUntil: number;
  battery: number;
  views: number;
  shots: number;
  hits: number;
  combo: number;
  lastShot: number;
  flashUntil: number;
  visitors: number;
  opIndex: number;
  lastUTurnMsg: number;
  ended: boolean;
  crowd: Person[];
  ops: OpWindow[];
  hitTimes: number[];
  crowdMul: number;
  final: boolean;
  netS: number;
  gone: boolean;
  shark: {
    s: number;
    dir: 1 | -1;
    speed: number;
    state: SharkState;
    until: number;
    jumpStart: number;
    lastJump: number;
    nextTurn: number;
  };
}

const SHIRTS = ["#e4572e", "#f3a712", "#4c86a8", "#a8c686", "#8e5572", "#f2f2f2", "#3d3d3d", "#e98a15"];

function makeCrowd(): Person[] {
  const out: Person[] = [];
  for (let i = 0; i < 150; i++) {
    const hot = i % 5 < 3;
    const s = hot ? HOTSPOT.from + Math.random() * (HOTSPOT.to - HOTSPOT.from) : 0.03 + Math.random() * 0.95;
    out.push({ s, off: -3 + Math.random() * 9, color: SHIRTS[i % SHIRTS.length], phase: Math.random() * 6 });
  }
  return out;
}

function gullTimes(n: number, ops: OpWindow[]): number[] {
  const base = [15, 44, 73, 30, 60];
  const out: number[] = [];
  for (let i = 0; i < n && i < base.length; i++) {
    let t = base[i] + Math.random() * 6;
    for (const o of ops) if (t >= o.at - 3 && t < o.at + o.length + 2) t = o.at + o.length + 3;
    if (t < 85) out.push(t);
  }
  return out.sort((a, b) => a - b);
}

export function newGame(gear: Gear = BASE_GEAR, day?: DayConfig): Game {
  const ops = day?.ops ?? [];
  return {
    gear,
    ops,
    hitTimes: [],
    crowdMul: day?.crowd ?? 1,
    final: day?.final ?? false,
    netS: 0.97,
    gone: false,
    gull: { phase: "none", t0: 0, shake: 0, x: 0, y: 0, times: gullTimes(day?.gulls ?? 2, ops) },
    steer: 0,
    t: 0,
    ps: 0.4,
    target: 0.4,
    still: 0,
    lockUntil: 0,
    guardUntil: 0,
    battery: 100,
    views: 0,
    shots: 0,
    hits: 0,
    combo: 0,
    lastShot: -1,
    flashUntil: 0,
    visitors: 1_512_340,
    opIndex: -1,
    lastUTurnMsg: -99,
    ended: false,
    crowd: makeCrowd(),
    shark: { s: 0.2, dir: 1, speed: 0.04, state: "swim", until: 3, jumpStart: -9, lastJump: -9, nextTurn: 6 },
  };
}

export const inHotspot = (s: number) => s >= HOTSPOT.from && s <= HOTSPOT.to;
export const atCafe = (s: number) => Math.abs(s - CAFE_S) < 0.03;
/** Standing on a footbridge deck (the player snaps onto it when stopping nearby). */
export const onBridge = (s: number) => BRIDGES.find((b) => Math.abs(b.s - s) < 0.006);
const nearBridge = (s: number, r = 0.035) => BRIDGES.find((b) => Math.abs(b.s - s) < r);
export const frameSize = (g: Game) => g.gear.frame * (onBridge(g.ps) ? 1.35 : 1);

export function crowdDensity(t: number, s: number, mul = 1): number {
  const base = (0.3 + 0.6 * Math.min(1, t / GAME_SECONDS)) * mul;
  const local = nearBridge(s, 0.02) ? 0.55 : inHotspot(s) ? 1 : 0.3;
  return Math.min(0.92, base * local * 1.1);
}

export function stillLimit(s: number) {
  if (onBridge(s)) return 7;
  return inHotspot(s) ? 4.5 : 8;
}

export function frameInfo(g: Game) {
  const d = Math.abs(g.shark.s - g.ps) * CHANNEL_LEN;
  const f = frameSize(g);
  const inFrame = !g.gone && g.shark.state !== "dive" && d <= f;
  return { inFrame, center: inFrame ? 1 - d / f : 0 };
}

function jump(g: Game) {
  const sh = g.shark;
  sh.state = "jump";
  sh.jumpStart = g.t;
  sh.until = g.t + 2.2;
  sh.lastJump = g.t;
}

function updateShark(g: Game, dt: number, emit: (e: GameEvent) => void, attract: boolean) {
  const sh = g.shark;
  const op = g.opIndex >= 0;
  if (g.t >= sh.until) {
    const r = Math.random();
    if (op) {
      sh.state = r < 0.75 ? "dive" : "fin";
      sh.until = g.t + 1.5 + Math.random();
    } else if (r < 0.1 && g.t - sh.lastJump > 9) {
      jump(g);
      if (!attract) emit({ text: "부캉이 점프!", tone: "info", kind: "jump" });
    } else if (r < 0.24) {
      sh.state = "dive";
      sh.until = g.t + 2.5 + Math.random() * 2.5;
    } else if (r < 0.56) {
      sh.state = "fin";
      sh.until = g.t + 2 + Math.random() * 2;
    } else {
      sh.state = "swim";
      sh.until = g.t + 2 + Math.random() * 3;
    }
  }
  if (!op && g.t >= sh.nextTurn) {
    sh.nextTurn = g.t + 5 + Math.random() * 6;
    const goal = Math.random() < 0.55 ? (HOTSPOT.from + HOTSPOT.to) / 2 : Math.random();
    sh.dir = goal > sh.s ? 1 : -1;
    sh.speed = 0.03 + Math.random() * 0.03;
  }
  if (g.gone) return;
  const leaving = g.final && g.netS < 0.12;
  if (leaving) {
    sh.dir = -1;
    sh.speed = Math.max(sh.speed, 0.05);
  }
  const v = sh.speed * (sh.state === "dive" ? 1.3 : 1) * (sh.state === "jump" ? 0.5 : 1);
  sh.s += sh.dir * v * dt;
  if (g.final && sh.s > g.netS - 0.03) {
    sh.s = g.netS - 0.03;
    sh.dir = -1;
  }
  if (leaving && sh.s < 0.005) {
    g.gone = true;
    sh.state = "dive";
    emit({ text: "부캉이가 바다로 떠났다… 잘가라, 부캉아!", tone: "info", kind: "farewell" });
    return;
  }
  if (!leaving && sh.s < 0.045) {
    sh.s = 0.045;
    sh.dir = 1;
    if (!attract && g.t - g.lastUTurnMsg > 15) {
      g.lastUTurnMsg = g.t;
      emit({ text: "출구 코앞에서 유턴!", tone: "info", kind: "uturn" });
    }
  }
  if (sh.s > 0.97) {
    sh.s = 0.97;
    sh.dir = -1;
  }
}

export function step(g: Game, dt: number, emit: (e: GameEvent) => void, attract = false) {
  g.t += dt;
  // Coast guard operations: the shark is herded seaward, U-turns, then shows off.
  const opIdx = attract ? -1 : g.ops.findIndex((o) => g.t >= o.at && g.t < o.at + o.length);
  if (g.final && !attract) {
    const prev = g.netS;
    g.netS = 0.97 - 0.93 * clamp((g.t - 4) / 80, 0, 1);
    if (prev >= 0.97 && g.netS < 0.97) emit({ text: "3차 외해 유도 작전 시작 (폰툰 + 그물)", tone: "warn", kind: "netStart" });
  }
  if (opIdx !== g.opIndex) {
    if (opIdx >= 0) {
      const op = g.ops[opIdx];
      emit({ text: `해경 ${op.title} (${op.tool})`, tone: "warn", kind: "opStart" });
      g.shark.dir = -1;
      g.shark.speed = 0.07;
      g.shark.state = "dive";
      g.shark.until = g.t + 1.5;
    } else if (g.opIndex >= 0) {
      jump(g);
      g.shark.nextTurn = g.t + 3;
      emit({ text: "작전 실패! 부캉이 복귀 점프", tone: "info", kind: "opEnd" });
    }
    g.opIndex = opIdx;
  }
  updateShark(g, dt, emit, attract);
  if (attract) return;

  const density = crowdDensity(g.t, g.ps, g.crowdMul);
  const speed = 0.12 * g.gear.speed * (1 - 0.65 * density);
  const charging = atCafe(g.ps);
  const prevPs = g.ps;
  if (g.steer !== 0 && g.t >= g.guardUntil) {
    g.ps = clamp(g.ps + g.steer * speed * dt, 0.02, 0.99);
    g.target = g.ps;
  }
  const diff = g.target - g.ps;
  if (g.steer !== 0 && g.t >= g.guardUntil) {
    g.still = 0;
  } else if (Math.abs(diff) > 0.002) {
    g.ps += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
    g.still = 0;
  } else if (charging) {
    g.still = 0;
  } else {
    g.still += dt;
  }
  // Bridge magnet: stopping near a footbridge walks the player onto its deck.
  if (g.steer === 0 && Math.abs(g.target - g.ps) <= 0.002 && g.t >= g.guardUntil) {
    const b = nearBridge(g.ps);
    if (b && Math.abs(b.s - g.ps) > 0.002) g.target = b.s;
  }
  updateGull(g, dt, Math.abs(g.ps - prevPs), emit);
  if (g.still > stillLimit(g.ps) && g.t >= g.guardUntil) {
    g.guardUntil = g.t + 2;
    g.lockUntil = g.t + 2;
    g.still = 0;
    g.target = inHotspot(g.ps) ? HOTSPOT.to + 0.06 : clamp(g.ps + (g.ps > 0.5 ? -0.06 : 0.06), 0.02, 0.99);
    g.combo = 0;
    emit({ text: "삐익! 난간에서 물러나세요", tone: "warn", kind: "whistle" });
  }
  g.battery = clamp(g.battery + (charging ? 16 : -0.45 * g.gear.drain) * dt, 0, 100);
  g.visitors += dt * (150 + Math.random() * 120);
}

function updateGull(g: Game, dt: number, moved: number, emit: (e: GameEvent) => void) {
  const gl = g.gull;
  const c = channelAt(g.ps);
  if (gl.phase === "none") {
    if (gl.times.length && g.t >= gl.times[0] && g.opIndex < 0) {
      gl.times.shift();
      gl.phase = "in";
      gl.t0 = g.t;
      gl.shake = 0;
      gl.x = MAP_W + 12;
      gl.y = Math.max(10, c.y - 70);
      emit({ text: "부산갈매기 '부기' 난입!", tone: "warn", kind: "gull" });
    }
    return;
  }
  const k = Math.min(1, dt * 6);
  if (gl.phase === "in") {
    gl.x += (c.x - gl.x) * k;
    gl.y += (c.y - gl.y) * k;
    if (g.t - gl.t0 > 1.1) {
      gl.phase = "perch";
      gl.t0 = g.t;
    }
  } else if (gl.phase === "perch") {
    gl.x += (c.x - gl.x) * k;
    gl.y += (c.y - gl.y) * k;
    gl.shake += moved;
    if (gl.shake >= 0.05) {
      gl.phase = "out";
      gl.t0 = g.t;
      emit({ text: "부기를 쫓아냈다!", tone: "info", kind: "gullAway" });
    } else if (g.t - gl.t0 > 6) {
      gl.phase = "out";
      gl.t0 = g.t;
      emit({ text: "부기가 날아갔다", tone: "info", kind: "gullAway" });
    }
  } else if (gl.phase === "out") {
    gl.x -= 70 * dt;
    gl.y -= 60 * dt;
    if (g.t - gl.t0 > 1.4) gl.phase = "none";
  }
}

export interface ShotResult {
  views: number;
  label: string;
  tags: DexId[];
}

export function shoot(g: Game, emit: (e: GameEvent) => void): ShotResult | null {
  if (g.ended || g.t - g.lastShot < 0.5) return null;
  if (g.t < g.lockUntil) {
    emit({ text: "안전요원 제지 중", tone: "warn", kind: "locked" });
    return null;
  }
  const cost = 5 * g.gear.drain;
  if (g.battery < cost) {
    emit({ text: "배터리 부족! 관리동 카페에서 충전", tone: "warn", kind: "battery" });
    return null;
  }
  g.lastShot = g.t;
  g.battery -= cost;
  g.shots += 1;
  g.flashUntil = g.t + 0.12;
  if (g.gull.phase === "perch") {
    const v = Math.round(300 + Math.random() * 300);
    g.views += v;
    g.hits += 1;
    g.combo = 0;
    emit({ text: `+${v.toLocaleString("ko-KR")} 부기 난입 컷`, tone: "hit", kind: "gullShot" });
    return { views: v, label: "부기 난입 컷", tags: ["gull"] };
  }
  const { inFrame, center } = frameInfo(g);
  if (!inFrame) {
    g.combo = 0;
    g.hitTimes = [];
    emit({ text: g.shark.state === "dive" ? "잠수 중… 물결만 찍힘" : "놓쳤다!", tone: "miss", kind: g.shark.state === "dive" ? "dive" : "miss" });
    return null;
  }
  let mult = 1;
  let label = "수중 실루엣";
  if (g.shark.state === "fin") {
    mult = 1.6;
    label = "지느러미 컷";
  }
  if (g.shark.state === "jump") {
    mult = 5;
    label = "점프 직찍";
  }
  if (g.opIndex >= 0) {
    mult *= 2;
    label = "작전 현장";
  }
  const bridge = onBridge(g.ps);
  if (bridge) mult *= 1.3;
  mult *= g.gear.lens;
  const views = Math.round((900 + 2600 * center) * mult * (1 + 0.25 * Math.min(g.combo, 8)) + Math.random() * 99);
  g.views += views;
  g.hits += 1;
  g.combo += 1;
  emit({ text: `+${views.toLocaleString("ko-KR")} ${label}${bridge ? " · 다리 위 앵글" : ""}`, tone: "hit", kind: g.opIndex >= 0 ? "hitOp" : g.shark.state === "jump" ? "hitJump" : g.shark.state === "fin" ? "hitFin" : "hitSwim" });
  const st = g.shark.state;
  const tags: DexId[] = [];
  if (st === "swim") tags.push("silhouette");
  if (st === "fin") tags.push("fin");
  if (st === "jump") tags.push("jump");
  if (bridge) tags.push("bridge");
  if (inHotspot(g.ps) && crowdDensity(g.t, g.ps, g.crowdMul) >= 0.7) tags.push("crowd");
  if (g.shark.s < 0.09) tags.push("uturn");
  if (center >= 0.9) tags.push("center");
  if (g.combo >= 5) tags.push("combo");
  if (g.opIndex >= 0) tags.push("op");
  if (st === "jump" && center >= 0.85) tags.push("legend");
  // Gear-gated legend shots
  const lv = (k: "stick" | "powerbank" | "lens" | "shoes") => g.gear.levels?.[k] ?? 0;
  g.hitTimes = [...g.hitTimes.filter((t) => g.t - t <= 6), g.t];
  if (lv("lens") >= 8 && st === "fin" && center >= 0.6) tags.push("ridge");
  if (lv("lens") >= 15 && (st === "jump" || st === "fin") && center >= 0.8) tags.push("teeth");
  if (lv("shoes") >= 12 && Math.abs(g.steer) >= 0.6 && Math.sign(g.steer) === g.shark.dir) tags.push("chase");
  if (lv("powerbank") >= 12 && g.hitTimes.length >= 5) tags.push("burst");
  if (lv("stick") >= 18 && st === "jump" && inHotspot(g.ps) && crowdDensity(g.t, g.ps, g.crowdMul) >= 0.7) tags.push("panorama");
  if (lv("stick") >= 10 && lv("lens") >= 10 && g.final && g.netS < 0.25) tags.push("farewell");
  return { views, label, tags };
}

// ---------- pixel renderer ----------
const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

function strokeChannel(ctx: CanvasRenderingContext2D, width: number, color: string) {
  ctx.beginPath();
  CHANNEL.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";
  ctx.stroke();
}

function drawMap(ctx: CanvasRenderingContext2D, t: number) {
  px(ctx, 0, 0, MAP_W, MAP_H, "#7fae58");
  // grass texture
  for (let y = 2; y < MAP_H; y += 7) for (let x = (y * 3) % 9; x < MAP_W; x += 9) px(ctx, x, y, 1, 1, "#6f9c4b");
  // rail yard + station
  px(ctx, 170, 0, 10, MAP_H - 70, "#8a8a8a");
  for (let y = 0; y < MAP_H - 70; y += 4) px(ctx, 170, y, 10, 1, "#6d5a45");
  px(ctx, 172, 0, 1, MAP_H - 70, "#c9c9c9");
  px(ctx, 177, 0, 1, MAP_H - 70, "#c9c9c9");
  px(ctx, 120, 0, 50, 12, "#c7cbd6");
  px(ctx, 120, 10, 50, 2, "#8c93a3");
  // parking lot
  px(ctx, 150, 252, 30, 68, "#9a9a9a");
  for (let y = 256; y < 318; y += 6) px(ctx, 152, y, 26, 1, "#e6e6e6");
  // sea (bottom-left)
  ctx.fillStyle = "#2a6f97";
  ctx.beginPath();
  ctx.moveTo(0, 236);
  ctx.lineTo(0, MAP_H);
  ctx.lineTo(78, MAP_H);
  ctx.closePath();
  ctx.fill();
  // promenade then water
  strokeChannel(ctx, 36, "#d9cfb6");
  strokeChannel(ctx, 18, "#5d6d73");
  strokeChannel(ctx, 16, "#2f7fa8");
  strokeChannel(ctx, 8, "#3a92bf");
  // sparkles drifting on the water
  for (let i = 0; i < 46; i++) {
    const s = ((i * 0.0217 + t * 0.004) % 1 + 1) % 1;
    const c = channelAt(s);
    const o = Math.sin(i * 7.1) * 5;
    if ((i + Math.floor(t * 2)) % 3 === 0) px(ctx, c.x + c.nx * o, c.y + c.ny * o, 2, 1, "#9fd3ea");
  }
  for (let i = 0; i < 18; i++) {
    const x = (i * 23 + t * 4) % 70;
    const y = 250 + ((i * 37) % 66);
    if (y > 236 + x * 1.05) px(ctx, x, y, 2, 1, "#7fb8d6");
  }
  // round lawn
  ctx.fillStyle = "#9cc95f";
  ctx.beginPath();
  ctx.arc(LAWN.x, LAWN.y, LAWN.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e3d8ba";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(LAWN.x, LAWN.y, 30, 0, Math.PI * 2);
  ctx.moveTo(LAWN.x - LAWN.r + 4, LAWN.y + 10);
  ctx.quadraticCurveTo(LAWN.x, LAWN.y - 20, LAWN.x + LAWN.r - 4, LAWN.y + 12);
  ctx.stroke();
  ctx.fillStyle = "#b9dc84";
  ctx.beginPath();
  ctx.arc(LAWN.x, LAWN.y, 14, 0, Math.PI * 2);
  ctx.fill();
  // opera house
  px(ctx, 112, 290, 34, 16, "#eef1f4");
  px(ctx, 112, 286, 14, 4, "#d6dde4");
  px(ctx, 130, 284, 16, 6, "#d6dde4");
  px(ctx, 112, 305, 34, 2, "#9aa6b2");
  // footbridges
  for (const b of BRIDGES) {
    const c = channelAt(b.s);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.atan2(c.ny, c.nx));
    px(ctx, -16, -3, 32, 6, "#5e5e5e");
    px(ctx, -15, -2, 30, 4, "#ece6d6");
    ctx.restore();
  }
  // cafe
  const cafe = promenadeAt(CAFE_S, 12);
  px(ctx, cafe.x - 6, cafe.y - 5, 12, 10, "#6b4226");
  px(ctx, cafe.x - 7, cafe.y - 6, 14, 3, "#a0522d");
  px(ctx, cafe.x - 1, cafe.y, 3, 3, "#fff3d6");
}

function drawCrowd(ctx: CanvasRenderingContext2D, g: Game) {
  const share = Math.min(1, 0.35 + (g.t / GAME_SECONDS) * 0.65);
  const n = Math.floor(g.crowd.length * share);
  for (let i = 0; i < n; i++) {
    const p = g.crowd[i];
    const pt = promenadeAt(p.s, p.off);
    const bob = Math.sin(g.t * 3 + p.phase) > 0.6 ? 1 : 0;
    px(ctx, pt.x, pt.y - 3 - bob, 1, 1, "#f1c9a5");
    px(ctx, pt.x - 0.5, pt.y - 2 - bob, 2, 2, p.color);
  }
}

function drawShark(ctx: CanvasRenderingContext2D, g: Game) {
  if (g.gone) return;
  const sh = g.shark;
  const c = channelAt(sh.s);
  const wob = Math.sin(g.t * 2.2) * 2.5;
  const x = c.x + c.nx * wob;
  const y = c.y + c.ny * wob;
  let ang = Math.atan2(c.ty, c.tx);
  if (sh.dir < 0) ang += Math.PI;
  const tail = Math.sin(g.t * 9) * 1.2;
  if (sh.state === "dive") {
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(g.t * 4);
    ctx.strokeStyle = "#cfe9f5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 4 + ((g.t * 3) % 3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  const body = (scale: number, color: string, belly: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-11, -3 + tail);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-11, 3 + tail);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = belly;
    ctx.fillRect(-3, 0.6, 8, 1);
    ctx.restore();
  };
  if (sh.state === "jump") {
    const ph = clamp((g.t - sh.jumpStart) / 2.2, 0, 1);
    const h = Math.sin(Math.PI * ph) * 16;
    ctx.globalAlpha = 0.35;
    body(1.1, "#0d2733", "#0d2733");
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(0, -h);
    body(1.5, "#56656e", "#dfe4e6");
    ctx.restore();
    if (ph < 0.2 || ph > 0.8) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + g.t;
        px(ctx, x + Math.cos(a) * 6, y + Math.sin(a) * 3 - 1, 1, 1, "#ffffff");
      }
    }
    return;
  }
  ctx.globalAlpha = sh.state === "fin" ? 0.75 : 0.9;
  body(1, "#1b3a4b", "#2b5468");
  ctx.globalAlpha = 1;
  if (sh.state === "fin") {
    px(ctx, x - 1, y - 6, 2, 1, "#2a2a2a");
    px(ctx, x - 1, y - 5, 3, 2, "#2a2a2a");
    px(ctx, x - 2, y - 3, 5, 2, "#2a2a2a");
    px(ctx, x - 4, y - 1, 2, 1, "#e8f6fb");
    px(ctx, x + 3, y - 1, 2, 1, "#e8f6fb");
  }
}

function drawOp(ctx: CanvasRenderingContext2D, g: Game) {
  if (g.final && g.netS < 0.97) {
    const c = channelAt(g.netS);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.atan2(c.ny, c.nx));
    px(ctx, -13, -3, 26, 6, "#e07a1f");
    px(ctx, -13, -1, 26, 1, "#f4f4f4");
    for (let i = -11; i <= 11; i += 4) px(ctx, i, -5, 2, 2, "#1d3557");
    ctx.restore();
    const n = channelAt(Math.min(0.99, g.netS + 0.015));
    for (let o = -8; o <= 8; o += 2) px(ctx, n.x + n.nx * o, n.y + n.ny * o, 1, 1, "#f4d35e");
  }
  if (g.opIndex < 0) return;
  const boat = channelAt(0.05);
  px(ctx, boat.x - 7, boat.y - 3, 14, 6, "#f4f4f4");
  px(ctx, boat.x - 7, boat.y, 14, 2, "#e0661b");
  px(ctx, boat.x - 2, boat.y - 6, 5, 3, "#2f4e7a");
  if (g.ops[g.opIndex]?.tool === "워터펌프") {
    for (let i = 0; i < 10; i++) {
      const c = channelAt(0.07 + i * 0.012 + ((g.t * 0.05) % 0.012));
      px(ctx, c.x + Math.sin(i + g.t * 8) * 3, c.y, 2, 2, "#e8f6fb");
    }
  } else {
    const c = channelAt(0.18);
    for (let o = -9; o <= 9; o += 2) px(ctx, c.x + c.nx * o, c.y + c.ny * o, 1, 1, "#f4d35e");
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: Game) {
  const deck = onBridge(g.ps);
  const near = deck ? undefined : nearBridge(g.ps, 0.06);
  if (near) {
    const b = channelAt(near.s);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.ny, b.nx));
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(g.t * 8);
    ctx.strokeStyle = "#ffd400";
    ctx.lineWidth = 1;
    ctx.strokeRect(-16.5, -3.5, 33, 7);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  const cc = channelAt(g.ps);
  const p = deck ? { x: cc.x + cc.nx * 9, y: cc.y + cc.ny * 9 + 2 } : promenadeAt(g.ps, 2);
  px(ctx, p.x - 1, p.y - 6, 3, 2, "#f1c9a5");
  px(ctx, p.x - 2, p.y - 4, 5, 4, "#ff6a13");
  px(ctx, p.x - 1, p.y, 1, 2, "#24323d");
  px(ctx, p.x + 1, p.y, 1, 2, "#24323d");
  px(ctx, p.x + 3, p.y - 5, 2, 3, "#ffffff");
  if (g.t < g.guardUntil) {
    px(ctx, p.x + 6, p.y - 6, 3, 2, "#f1c9a5");
    px(ctx, p.x + 5, p.y - 4, 5, 4, "#f2c200");
    px(ctx, p.x + 7, p.y - 11, 1, 3, "#ff3b30");
    px(ctx, p.x + 7, p.y - 7, 1, 1, "#ff3b30");
  }
  // viewfinder over the water in front of the player
  const c = channelAt(g.ps);
  const { inFrame } = frameInfo(g);
  const col = inFrame ? "#ffd400" : "#ffffff";
  const r = Math.round(frameSize(g) * 0.65);
  const k = 4;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const cx = c.x + sx * r;
    const cy = c.y + sy * r;
    px(ctx, sx < 0 ? cx : cx - k + 1, cy, k, 1, col);
    px(ctx, cx, sy < 0 ? cy : cy - k + 1, 1, k, col);
  }
  px(ctx, c.x, c.y, 1, 1, col);
}

function drawGull(ctx: CanvasRenderingContext2D, g: Game) {
  const gl = g.gull;
  if (gl.phase === "none") return;
  const perched = gl.phase === "perch";
  const flap = perched ? Math.sin(g.t * 14) > 0 : Math.sin(g.t * 20) > 0;
  ctx.save();
  ctx.translate(Math.round(gl.x), Math.round(gl.y));
  const sc = perched ? 2.4 : 1.6;
  ctx.scale(sc, sc);
  const W = "#ffffff";
  const G = "#9aa3ab";
  px(ctx, -3, -1, 7, 3, W); // body
  px(ctx, 3, -3, 3, 3, W); // head
  px(ctx, 6, -2, 2, 1, "#f2c200"); // beak
  px(ctx, 7, -1, 1, 1, "#e0301e");
  px(ctx, 4, -2, 1, 1, "#1b1b1b"); // eye
  px(ctx, -5, 0, 2, 1, G); // tail
  if (flap) {
    px(ctx, -2, -5, 4, 4, G);
    px(ctx, -2, -6, 2, 1, "#2a2a2a");
  } else {
    px(ctx, -2, 2, 4, 3, G);
    px(ctx, -2, 5, 2, 1, "#2a2a2a");
  }
  if (perched) {
    px(ctx, -1, 2, 1, 2, "#f2a33a");
    px(ctx, 1, 2, 1, 2, "#f2a33a");
  }
  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, g: Game, attract = false) {
  ctx.imageSmoothingEnabled = false;
  drawMap(ctx, g.t);
  drawOp(ctx, g);
  drawCrowd(ctx, g);
  drawShark(ctx, g);
  if (!attract) drawPlayer(ctx, g);
  if (!attract) drawGull(ctx, g);
  if (g.t < g.flashUntil) px(ctx, 0, 0, MAP_W, MAP_H, "rgba(255,255,255,0.7)");
}
