import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Check, Flag, Music, Vibrate, Volume2, VolumeX, BookOpen, Lock, Battery, BatteryLow, Camera, Megaphone, Ship, Trophy, Users, RotateCcw, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppShortcut, useShortcutScope } from "@/components/shortcut-provider";
import { BRIDGES, CAFE_S, DEX, GAME_SECONDS, HOTSPOT, MAP_H, MAP_W, TEAM_RANKING, CHAT, CHAT_NICKS, verdict, type DexId, type RankEntry } from "@/lib/bukangi-data";
import { DAYS, loadDays, saveDays, type DayConfig, type DayProgress } from "@/lib/park-days";
import { gearFrom, loadGearState, revenueFor, saveGearState, type GearState } from "@/lib/park-gear";
import { UpgradeShop } from "@/components/upgrade-shop";
import { PhotoViewer, type PhotoShot } from "@/components/photo-viewer";
import {
  atCafe,
  channelAt,
  frameInfo,
  inHotspot,
  onBridge,
  nearestPromenadeS,
  newGame,
  promenadeAt,
  render,
  shoot,
  step,
  stillLimit,
  type Game,
  type GameEvent,
  type EventKind,
  type Tone,
} from "@/lib/park-engine";
import { cn } from "@/lib/utils";
import { PdfExportButton } from "@/components/pdf-export-button";
import { loadAudioSettings, playSfx, saveAudioSettings, startBgm, stopBgm, unlockAudio, vibrate, type AudioSettings, type Sfx } from "@/lib/park-audio";

type Screen = "title" | "play" | "result";

interface BestShot {
  views: number;
  label: string;
  snap: Game;
  fx: number;
  fy: number;
}

interface Thumb {
  snap: Game;
  fx: number;
  fy: number;
  views?: number;
  day?: number;
}

const THUMB_KEY = "bukangi-thumbs-v1";
function loadThumbs(): Partial<Record<DexId, Thumb>> {
  try {
    const p = JSON.parse(window.localStorage.getItem(THUMB_KEY) ?? "{}") as Record<string, Thumb>;
    const out: Partial<Record<DexId, Thumb>> = {};
    for (const d of DEX) {
      const t = p[d.id];
      if (t && typeof t.fx === "number" && typeof t.fy === "number" && t.snap && typeof t.snap === "object" && Array.isArray(t.snap.crowd)) out[d.id] = t;
    }
    return out;
  } catch {
    return {};
  }
}
function saveThumbs(t: Partial<Record<DexId, Thumb>>) {
  try {
    window.localStorage.setItem(THUMB_KEY, JSON.stringify(t));
  } catch {
    /* photos last for this session */
  }
}

type DexRecord = Partial<Record<DexId, { views: number }>>;
const DEX_KEY = "bukangi-dex-v1";

function loadDex(): DexRecord {
  try {
    const raw = window.localStorage.getItem(DEX_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    const out: DexRecord = {};
    for (const d of DEX) {
      const v = (parsed as Record<string, unknown>)[d.id];
      if (v && typeof v === "object" && typeof (v as { views?: unknown }).views === "number") out[d.id] = { views: (v as { views: number }).views };
    }
    return out;
  } catch {
    return {};
  }
}

function saveDex(d: DexRecord) {
  try {
    window.localStorage.setItem(DEX_KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable: the collection still lasts for this session */
  }
}

const RARITY_CLASS: Record<string, string> = {
  일반: "bg-slate-700 text-white",
  희귀: "bg-sky-800 text-white",
  전설: "bg-amber-700 text-white",
  장비: "bg-emerald-800 text-white",
};

interface RunResult {
  name: string;
  views: number;
  shots: number;
  hits: number;
  best: BestShot | null;
  newDex: DexId[];
  revenue: number;
  day: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

// ---------- map labels (HTML overlay so text stays crisp) ----------
function MapLabels() {
  const labels = useMemo(() => {
    const out: { text: string; x: number; y: number; strong?: boolean }[] = [];
    for (const b of BRIDGES) {
      const c = channelAt(b.s);
      out.push({ text: b.name, x: c.x - c.nx * 22, y: c.y - c.ny * 22 });
    }
    const hot = promenadeAt((HOTSPOT.from + HOTSPOT.to) / 2, 26);
    out.push({ text: "명당", x: hot.x + 4, y: hot.y, strong: true });
    const cafe = promenadeAt(CAFE_S, 26);
    out.push({ text: "관리동 카페", x: cafe.x + 8, y: cafe.y });
    out.push({ text: "부산역", x: 145, y: 18, strong: true });
    out.push({ text: "북항 바다", x: 20, y: 300 });
    out.push({ text: "문화공원", x: 100, y: 200 });
    out.push({ text: "오페라하우스", x: 129, y: 312 });
    return out;
  }, []);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {labels.map((l) => (
        <span
          key={l.text}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm px-1 text-[10px] leading-tight font-semibold text-white [text-shadow:0_1px_0_#000,0_0_3px_#000]",
            l.strong && "bg-black/45 text-[11px]",
          )}
          style={{ left: `${(l.x / MAP_W) * 100}%`, top: `${(l.y / MAP_H) * 100}%` }}
        >
          {l.text}
        </span>
      ))}
    </div>
  );
}

// ---------- attract-mode map for the title screen ----------
function AttractMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = newGame();
    g.t = 40;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(g, dt, () => undefined, true);
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) render(ctx, g, true);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <figure className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-md border-4 border-neutral-900 shadow-lg">
      <canvas
        ref={canvasRef}
        width={MAP_W}
        height={MAP_H}
        data-aether-canvas-purpose="non-drawing"
        className="block h-full w-full [image-rendering:pixelated]"
        aria-hidden="true"
      />
      <MapLabels />
      <figcaption className="sr-only">북항친수공원 수로를 헤엄치는 부캉이 픽셀 지도</figcaption>
    </figure>
  );
}

function RankingTable({ rows, highlight }: { rows: RankEntry[]; highlight?: RankEntry }) {
  return (
    <section aria-labelledby="rank-title" className="space-y-2">
      <h2 id="rank-title" className="flex items-center gap-2 text-sm font-semibold">
        <Trophy className="size-4" aria-hidden="true" /> 팀 랭킹
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">순위</TableHead>
            <TableHead>닉네임</TableHead>
            <TableHead className="text-right">조회수</TableHead>
            <TableHead className="hidden sm:table-cell">베스트 샷</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.name}-${i}`} aria-current={r === highlight ? "true" : undefined} className={cn(r === highlight && "bg-muted font-semibold")}>
              <TableCell className="tabular-nums">{i + 1}</TableCell>
              <TableCell className="max-w-[9rem] truncate">
                {r.name}
                {r.you && <Badge className="ml-1.5 bg-orange-700 text-white">나</Badge>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.views)}</TableCell>
              <TableCell className="hidden sm:table-cell">{r.bestShot}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

const RULES = [
  { icon: Camera, title: "타이밍 셔터", body: "부캉이가 프레임 가운데일수록, 점프 순간일수록 조회수 대박" },
  { icon: Users, title: "구름 인파", body: "명당(제4·5보도교 사이)은 붐벼서 걸음이 느려져요" },
  { icon: Megaphone, title: "안전요원 호루라기", body: "난간에 너무 오래 서 있으면 삐익! 잠시 촬영 불가" },
  { icon: BatteryLow, title: "폰 배터리", body: "찍을수록 닳아요. 관리동 카페에서 충전" },
  { icon: Ship, title: "해경 작전 (작전일)", body: "외해 유도 작전 중엔 잠수… 끝나면 복귀 점프" },
  { icon: Flag, title: "Day 1 → Day 34", body: "날마다 목표 조회수를 넘기면 다음 날이 열려요" },
];

const TAG_STYLE: Record<string, { label: string; cls: string }> = {
  holiday: { label: "연휴", cls: "bg-rose-700 text-white" },
  op: { label: "작전", cls: "bg-red-800 text-white" },
  news: { label: "뉴스", cls: "bg-sky-800 text-white" },
  final: { label: "작별", cls: "bg-amber-700 text-white" },
  weekend: { label: "주말", cls: "bg-violet-700 text-white" },
};

function DayCalendar({ progress, selected, onSelect }: { progress: DayProgress; selected: number; onSelect: (d: number) => void }) {
  const lead = 5; // 2026-09-18 is a Friday
  const cells: (DayConfig | null)[] = [...Array(lead).fill(null), ...DAYS];
  const sel = DAYS[selected - 1];
  return (
    <section aria-labelledby="cal-title" className="space-y-2">
      <h2 id="cal-title" className="flex items-center gap-2 text-sm font-semibold">
        <Flag className="size-4" aria-hidden="true" /> 부캉이 34일
        <span className="tabular-nums text-muted-foreground">{progress.cleared}/34 클리어</span>
      </h2>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground" aria-hidden="true">
        {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div role="listbox" aria-label="날짜 선택" className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} aria-hidden="true" />;
          const cleared = d.day <= progress.cleared;
          const open = d.day <= progress.cleared + 1;
          const isSel = d.day === selected;
          const tag = d.tag ? TAG_STYLE[d.tag] : null;
          return (
            <button
              key={d.day}
              type="button"
              role="option"
              aria-selected={isSel}
              disabled={!open}
              aria-label={`Day ${d.day} ${d.date} ${d.title}${cleared ? " 클리어" : open ? "" : " 잠김"}`}
              onClick={() => onSelect(d.day)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-md border text-[11px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40",
                isSel ? "border-primary bg-primary text-primary-foreground" : cleared ? "bg-muted" : "bg-card hover:bg-accent",
              )}
            >
              <span className="font-bold tabular-nums">{d.date}</span>
              {cleared ? <Check className="size-3" aria-hidden="true" /> : !open ? <Lock className="size-3" aria-hidden="true" /> : <span className="tabular-nums">D{d.day}</span>}
              {tag && <span className={cn("absolute -top-1 -right-1 size-2.5 rounded-full border border-background", tag.cls)} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]" aria-hidden="true">
        {Object.values(TAG_STYLE).map((t) => (
          <span key={t.label} className="flex items-center gap-1">
            <span className={cn("size-2.5 rounded-full", t.cls)} />
            {t.label}
          </span>
        ))}
      </div>
      {sel && (
        <div className="rounded-md border p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Day {sel.day} · {sel.date}({sel.weekday}) · {sel.title}
            {sel.tag && <span className={cn("rounded-sm px-1.5 text-[10px]", TAG_STYLE[sel.tag].cls)}>{TAG_STYLE[sel.tag].label}</span>}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{sel.note}</p>
          <p className="mt-1 text-sm tabular-nums">
            목표 <span className="font-semibold">{fmt(sel.goal)}회</span>
            {progress.best[sel.day] ? ` · 내 최고 ${fmt(progress.best[sel.day])}회` : ""}
          </p>
        </div>
      )}
    </section>
  );
}

function TitleScreen({ name, setName, onStart, rows, dex, thumbs, gear, setGear, sound, progress, selected, onSelect }: { name: string; setName: (v: string) => void; onStart: () => void; rows: RankEntry[]; dex: DexRecord; thumbs: Partial<Record<DexId, Thumb>>; gear: GearState; setGear: (g: GearState) => void; sound: boolean; progress: DayProgress; selected: number; onSelect: (d: number) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[320px_1fr] lg:gap-10 lg:py-10">
      <div className="space-y-6">
        <AttractMap />
        <div className="hidden lg:block">
          <DayCalendar progress={progress} selected={selected} onSelect={onSelect} />
        </div>
      </div>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">부캉이 직캠 챌린지</h1>
          <p className="text-sm text-muted-foreground">2026.9.18 첫 출몰 → 10.21 바다로 · 흑상어 암컷 약 3m · 34일간 누적 방문객 170만+</p>
        </header>
        <div className="lg:hidden">
          <DayCalendar progress={progress} selected={selected} onSelect={onSelect} />
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            onStart();
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="nick">닉네임</Label>
            <Input id="nick" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="예: 북항직캠러" />
          </div>
          <Button type="submit" size="lg" disabled={!name.trim()} className="h-11 text-base">
            <Camera aria-hidden="true" /> Day {selected} 촬영 시작
          </Button>
        </form>
        <UpgradeShop gear={gear} setGear={setGear} sound={sound} />
        <ul className="grid gap-2 sm:grid-cols-2">
          {RULES.map((r) => (
            <li key={r.title} className="flex gap-3 rounded-md border p-3">
              <r.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <DexGrid dex={dex} thumbs={thumbs} levels={gear.levels} />
        <RankingTable rows={rows} />
      </div>
    </div>
  );
}

// ---------- play ----------
interface Hud {
  left: number;
  views: number;
  battery: number;
  combo: number;
  inFrame: boolean;
  op: string | null;
  locked: boolean;
  charging: boolean;
  visitors: number;
  still: number;
  hot: boolean;
  gull: boolean;
  bridge: string | null;
}

interface Popup {
  id: number;
  text: string;
  tone: Tone;
}

const TONE_CLASS: Record<Tone, string> = {
  hit: "bg-yellow-300 text-neutral-900",
  miss: "bg-neutral-800 text-white",
  warn: "bg-red-700 text-white",
  info: "bg-sky-800 text-white",
};

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const EVENT_FX: Partial<Record<EventKind, { sfx?: Sfx; buzz?: number | number[]; chat?: number }>> = {
  netStart: { sfx: "siren", buzz: [60, 60, 60], chat: 2 },
  farewell: { sfx: "dex", buzz: [80, 60, 80, 60, 200], chat: 3 },
  gull: { sfx: "gull", buzz: [30, 30, 30], chat: 2 },
  gullAway: { chat: 1 },
  gullShot: { sfx: "hit", buzz: 25, chat: 1 },
  jump: { sfx: "splash", chat: 1 },
  uturn: { chat: 2 },
  opStart: { sfx: "siren", buzz: [60, 60, 60], chat: 2 },
  opEnd: { sfx: "splash", chat: 2 },
  whistle: { sfx: "whistle", buzz: 220, chat: 1 },
  locked: { sfx: "miss" },
  battery: { sfx: "lowBattery", buzz: 80, chat: 1 },
  miss: { sfx: "miss", chat: 1 },
  dive: { sfx: "miss", chat: 1 },
  hitSwim: { sfx: "hit", buzz: 25, chat: 1 },
  hitFin: { sfx: "hit", buzz: 35, chat: 1 },
  hitJump: { sfx: "bigHit", buzz: [40, 40, 90], chat: 3 },
  hitOp: { sfx: "bigHit", buzz: [40, 40, 90], chat: 2 },
};

interface ChatLine {
  id: number;
  nick: string;
  text: string;
  hot: boolean;
}

function PlayScreen({ name, onFinish, dex, onDex, gear, audio, setAudio, day }: { name: string; onFinish: (r: RunResult) => void; dex: DexRecord; onDex: (id: DexId, views: number, thumb: Thumb) => void; gear: GearState; audio: AudioSettings; setAudio: (a: AudioSettings) => void; day: DayConfig }) {
  const audioRef = useRef(audio);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const chatId = useRef(0);
  const addChat = useCallback((pool: string, n = 1, hot = false) => {
    const lines = CHAT[pool];
    if (!lines) return;
    const add: ChatLine[] = [];
    for (let i = 0; i < n; i++) add.push({ id: ++chatId.current, nick: pick(CHAT_NICKS), text: pick(lines), hot });
    setChat((c) => [...c, ...add].slice(-3));
  }, []);
  const sfx = useCallback((s: Sfx) => audioRef.current.sfx && playSfx(s), []);
  const buzz = useCallback((p: number | number[]) => audioRef.current.haptics && vibrate(p), []);
  const dexRef = useRef<DexRecord>({ ...dex });
  const newDexRef = useRef<DexId[]>([]);
  const onDexRef = useRef(onDex);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game>(newGame(gearFrom(gear.levels), day));
  const bestRef = useRef<BestShot | null>(null);
  const finishRef = useRef(onFinish);
  const scopeRootRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [announce, setAnnounce] = useState("");
  const popupId = useRef(0);
  const scope = useShortcutScope("park");

  const emit = useCallback((e: GameEvent) => {
    const fx = e.kind ? EVENT_FX[e.kind] : undefined;
    if (fx?.sfx) sfx(fx.sfx);
    if (fx?.buzz) buzz(fx.buzz);
    if (fx?.chat && e.kind) addChat(e.kind, fx.chat, e.kind.startsWith("hit"));
    const id = ++popupId.current;
    setPopups((p) => [...p.slice(-2), { id, ...e }]);
    setAnnounce(e.text);
    window.setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1500);
  }, [sfx, buzz, addChat]);

  useEffect(() => {
    audioRef.current = audio;
    if (audio.bgm) startBgm();
    else stopBgm();
  }, [audio]);
  useEffect(() => () => stopBgm(), []);
  const emitRef = useRef(emit);
  useEffect(() => {
    finishRef.current = onFinish;
    emitRef.current = emit;
    onDexRef.current = onDex;
  }, [onFinish, emit, onDex]);

  useEffect(() => {
    scopeRootRef.current?.focus();
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    let nextIdle = performance.now() + 1500;
    let lastTick = 99;
    const loop = (now: number) => {
      const g = gameRef.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!g.ended) {
        step(g, dt, (e) => emitRef.current(e));
        if (now > nextIdle) {
          nextIdle = now + 1800 + Math.random() * 2600;
          addChat("idle");
        }
        const leftSec = Math.ceil(GAME_SECONDS - g.t);
        if (leftSec <= 5 && leftSec < lastTick && leftSec > 0) {
          lastTick = leftSec;
          if (audioRef.current.sfx) playSfx("tick");
        }
        if (g.t >= GAME_SECONDS) {
          g.ended = true;
          stopBgm();
          if (audioRef.current.sfx) playSfx("end");
          finishRef.current({ name, views: g.views, shots: g.shots, hits: g.hits, best: bestRef.current, newDex: newDexRef.current, revenue: revenueFor(g.views), day: day.day });
          return;
        }
      }
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) render(ctx, g);
      if (now - hudAt > 100) {
        hudAt = now;
        const op = g.opIndex >= 0 ? "해경 외해 유도 작전 중" : null;
        setHud({
          left: Math.max(0, GAME_SECONDS - g.t),
          views: g.views,
          battery: g.battery,
          combo: g.combo,
          inFrame: frameInfo(g).inFrame,
          gull: g.gull.phase === "perch",
          bridge: onBridge(g.ps)?.name ?? null,
          op,
          locked: g.t < g.lockUntil,
          charging: atCafe(g.ps) && g.battery < 100,
          visitors: g.visitors,
          still: Math.min(1, g.still / stillLimit(g.ps)),
          hot: inHotspot(g.ps),
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [name, addChat, day.day]);

  const doShoot = useCallback(() => {
    const g = gameRef.current;
    const before = g.shots;
    const res = shoot(g, (e) => emitRef.current(e));
    if (g.shots > before) sfx("shutter");
    if (!res) return;
    const c = channelAt(g.ps);
    let thumb: Thumb | null = null;
    const getThumb = () => (thumb ??= { snap: { ...structuredClone(g), flashUntil: 0 }, fx: c.x, fy: c.y, views: res.views, day: day.day });
    if (!bestRef.current || res.views > bestRef.current.views) {
      bestRef.current = { views: res.views, label: res.label, ...getThumb() };
    }
    for (const id of res.tags) {
      const prev = dexRef.current[id];
      if (!prev || res.views > prev.views) {
        if (!prev) {
          newDexRef.current.push(id);
          const entry = DEX.find((d) => d.id === id);
          emitRef.current({ text: `도감 등록! ${entry?.name ?? ""}`, tone: "info" });
          sfx("dex");
          addChat("dex");
        }
        dexRef.current[id] = { views: res.views };
        onDexRef.current(id, res.views, getThumb());
      }
    }
  }, [sfx, addChat, day.day]);

  const nudge = (d: number) => {
    const g = gameRef.current;
    g.target = Math.max(0.02, Math.min(0.99, g.ps + d));
  };
  useAppShortcut(["arrowleft", "arrowdown"], () => nudge(-0.05), { scope, allowRepeat: true });
  useAppShortcut(["arrowright", "arrowup"], () => nudge(0.05), { scope, allowRepeat: true });
  useAppShortcut("space", doShoot, { scope });

  // Floating slide pad: a drag that starts on the left side becomes a pad; a quick tap still moves to the tapped spot.
  const PAD_RANGE = 46;
  const gesture = useRef<{ id: number; x0: number; y0: number; mode: "pending" | "pad" | "drag" } | null>(null);
  const [pad, setPad] = useState<{ x: number; y: number; d: number } | null>(null);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el || gesture.current) return;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const leftSide = e.clientX - r.left < r.width * 0.55;
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, mode: leftSide ? "pending" : "drag" };
    if (!leftSide) pointTo(e);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const gs = gesture.current;
    const el = wrapRef.current;
    if (!gs || gs.id !== e.pointerId || !el) return;
    if (gs.mode === "drag") return pointTo(e);
    // Vertical scroll-like drag: up = toward 부산역 (top of map), down = toward the sea.
    const dy = e.clientY - gs.y0;
    if (gs.mode === "pending" && Math.hypot(e.clientX - gs.x0, dy) > 8) gs.mode = "pad";
    if (gs.mode !== "pad") return;
    const cdy = Math.max(-PAD_RANGE, Math.min(PAD_RANGE, dy));
    const v = -cdy / PAD_RANGE;
    gameRef.current.steer = Math.abs(v) < 0.12 ? 0 : v;
    const r = el.getBoundingClientRect();
    setPad({ x: gs.x0 - r.left, y: gs.y0 - r.top, d: cdy });
  };
  const onEnd = (e: PointerEvent<HTMLDivElement>) => {
    const gs = gesture.current;
    if (!gs || gs.id !== e.pointerId) return;
    if (gs.mode === "pending" && e.type === "pointerup") pointTo(e);
    gameRef.current.steer = 0;
    gesture.current = null;
    setPad(null);
  };

  const pointTo = (e: PointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * MAP_W;
    const y = ((e.clientY - r.top) / r.height) * MAP_H;
    gameRef.current.target = nearestPromenadeS(x, y);
  };

  const h = hud;
  const low = (h?.battery ?? 100) < 20;
  return (
    <div
      ref={scopeRootRef}
      tabIndex={0}
      {...scope.bindings}
      className="mx-auto flex h-[100dvh] w-full max-w-[480px] flex-col bg-neutral-950 text-white outline-none"
    >
      <div className="grid grid-cols-3 items-center gap-2 px-3 pt-2 pb-1.5 text-xs">
        <div>
          <p className="text-neutral-300">남은 시간</p>
          <p className="text-xl font-black tabular-nums">{Math.ceil(h?.left ?? GAME_SECONDS)}초</p>
        </div>
        <div className="text-center">
          <p className="text-neutral-300">조회수</p>
          <p className="text-xl font-black tabular-nums text-yellow-300">{fmt(h?.views ?? 0)}</p>
        </div>
        <div className="text-right">
          <p className="text-neutral-300">배터리</p>
          <div className="flex items-center justify-end gap-1.5">
            {low ? <BatteryLow className="size-4 text-red-400" aria-hidden="true" /> : <Battery className="size-4" aria-hidden="true" />}
            <div role="meter" aria-label="폰 배터리" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(h?.battery ?? 100)} className="h-2.5 w-14 overflow-hidden rounded-sm bg-neutral-700">
              <div className={cn("h-full", low ? "bg-red-500" : "bg-emerald-400")} style={{ width: `${h?.battery ?? 100}%` }} />
            </div>
            <span className="w-8 tabular-nums">{Math.round(h?.battery ?? 100)}%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-1.5 text-[11px]">
        <span className="truncate font-semibold text-neutral-200">
          Day {day.day} · {day.date} {day.title}
        </span>
        <span className="flex gap-1">
          {h?.op && <span className="rounded-sm bg-red-700 px-1.5 py-0.5 font-semibold">{h.op}</span>}
          {h?.bridge && <span className="rounded-sm bg-sky-800 px-1.5 py-0.5 font-semibold">{h.bridge} 위 · 프레임 확대</span>}
          {h?.charging && <span className="rounded-sm bg-emerald-800 px-1.5 py-0.5 font-semibold">충전 중</span>}
          {(h?.combo ?? 0) > 1 && <span className="rounded-sm bg-orange-700 px-1.5 py-0.5 font-semibold">{h?.combo}콤보</span>}
        </span>
      </div>

      <div className="px-3 pb-1.5">
        <div className="flex justify-between text-[10px] tabular-nums text-neutral-300">
          <span>목표 {fmt(day.goal)}회</span>
          <span>{Math.min(100, Math.floor(((h?.views ?? 0) / day.goal) * 100))}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-sm bg-neutral-800" role="meter" aria-label={`Day ${day.day} 목표 달성률`} aria-valuemin={0} aria-valuemax={day.goal} aria-valuenow={Math.round(h?.views ?? 0)}>
          <div className={cn("h-full", (h?.views ?? 0) >= day.goal ? "bg-emerald-400" : "bg-yellow-300")} style={{ width: `${Math.min(100, ((h?.views ?? 0) / day.goal) * 100)}%` }} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        <div
          ref={wrapRef}
          role="application"
          aria-label="북항친수공원 지도. 왼쪽을 위아래로 드래그하거나 산책로를 탭해 이동, 방향키로도 이동, 스페이스로 촬영"
          className="relative aspect-[9/16] max-h-full w-full max-w-full touch-none select-none overflow-hidden rounded-sm border-2 border-neutral-800"
          style={{ maxWidth: "calc((100dvh - 240px) * 9 / 16)" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
        >
          <canvas ref={canvasRef} width={MAP_W} height={MAP_H} data-aether-canvas-purpose="non-drawing" className="block h-full w-full [image-rendering:pixelated]" aria-hidden="true" />
          <MapLabels />
          <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-1">
            {popups.map((p) => (
              <span key={p.id} className={cn("bk-float-up rounded-sm px-2 py-1 text-sm font-bold shadow", TONE_CLASS[p.tone])}>
                {p.text}
              </span>
            ))}
          </div>
          {h && h.still > 0.45 && !h.locked && (
            <div className="pointer-events-none absolute inset-x-6 top-16">
              <p className="mb-1 text-center text-[11px] font-semibold [text-shadow:0_1px_2px_#000]">{h.hot ? "명당 체류 중… 안전요원이 보고 있어요" : "안전요원이 보고 있어요"}</p>
              <div className="h-1.5 overflow-hidden rounded-sm bg-black/50">
                <div className="h-full bg-red-500" style={{ width: `${h.still * 100}%` }} />
              </div>
            </div>
          )}
          <SlidePad pad={pad} range={PAD_RANGE} />
          <ul aria-hidden="true" className="pointer-events-none absolute right-1.5 bottom-16 flex w-[54%] flex-col gap-0.5">
            {chat.map((c) => (
              <li key={c.id} className="animate-in fade-in slide-in-from-bottom-1 rounded-sm bg-black/45 px-1.5 py-0.5 text-[11px] leading-snug [text-shadow:0_1px_1px_#000]">
                <span className={cn("mr-1 font-bold", c.hot ? "text-yellow-300" : "text-sky-300")}>{c.nick}</span>
                <span className="text-white">{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1 text-xs">
          <p className={cn("text-base font-bold", h?.inFrame && !h.locked ? "text-yellow-300" : "text-neutral-300")} aria-hidden="true">
            {h?.locked ? "촬영 제지 중" : h?.gull ? "부기가 가림! 움직여서 쫓기" : h?.inFrame ? "프레임 IN" : "부캉이 찾는 중"}
          </p>
          <p className="truncate text-neutral-400">{name}</p>
          <div className="mt-1 flex gap-1">
            {(
              [
                { key: "sfx", on: Volume2, off: VolumeX, label: "효과음" },
                { key: "bgm", on: Music, off: Music, label: "배경음악" },
                { key: "haptics", on: Vibrate, off: Vibrate, label: "진동" },
              ] as const
            ).map((t) => {
              const on = audio[t.key];
              const Icon = on ? t.on : t.off;
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={on}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => {
                    unlockAudio();
                    setAudio({ ...audio, [t.key]: !on });
                  }}
                  className={cn(
                    "grid size-8 place-items-center rounded-md border focus-visible:outline-2 focus-visible:outline-sky-400",
                    on ? "border-neutral-500 bg-neutral-800 text-white" : "border-neutral-700 text-neutral-500 line-through",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onPointerDown={doShoot}
          onClick={doShoot}
          aria-label="셔터 (스페이스)"
          className={cn(
            "grid size-20 place-items-center rounded-full border-4 transition-transform active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-400",
            h?.inFrame && !h.locked ? "border-yellow-300 bg-yellow-300/20" : "border-white bg-white/10",
          )}
        >
          <Camera className="size-8" aria-hidden="true" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <p className="sr-only" aria-live="polite">
        {h?.inFrame ? "부캉이가 프레임 안에 있어요" : ""}
      </p>
    </div>
  );
}

function SlidePad({ pad, range }: { pad: { x: number; y: number; d: number } | null; range: number }) {
  const H = range * 2 + 44;
  // Idle: a faint ghost pad bottom-left; active: centered where the thumb landed.
  const style = pad ? { left: pad.x - 22, top: pad.y - H / 2 } : { left: 10, bottom: 10 };
  const d = pad?.d ?? 0;
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute w-11 transition-opacity", pad ? "opacity-100" : "opacity-35")} style={{ ...style, height: H }}>
      <div className="absolute inset-0 rounded-full border border-white/45 bg-white/15 backdrop-blur-[1px]" />
      <span className={cn("absolute top-1.5 left-1/2 -translate-x-1/2 text-center text-[9px] leading-tight font-bold text-white/80", d < 0 && "text-white")}>
        ▲<br />역
      </span>
      <span className={cn("absolute bottom-1.5 left-1/2 -translate-x-1/2 text-center text-[9px] leading-tight font-bold text-white/80", d > 0 && "text-white")}>
        바다<br />▼
      </span>
      <div className="absolute left-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 bg-white/45 shadow" style={{ top: H / 2 + d }} />
    </div>
  );
}

// ---------- result ----------
function ShotCanvas({ shot, scale, box, label }: { shot: Thumb; scale: number; box: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) render(ctx, shot.snap);
  }, [shot]);
  return (
    <canvas
      ref={ref}
      width={MAP_W}
      height={MAP_H}
      data-aether-canvas-purpose="non-drawing"
      role="img"
      aria-label={label}
      className="absolute max-w-none [image-rendering:pixelated]"
      style={{ width: MAP_W * scale, height: MAP_H * scale, left: -(shot.fx * scale - box / 2), top: -(shot.fy * scale - box / 2) }}
    />
  );
}

function BestShotCard({ best }: { best: BestShot }) {
  const box = 132;
  return (
    <figure className="w-fit space-y-1.5">
      <div className="relative overflow-hidden rounded-sm border-[6px] border-b-[22px] border-white bg-neutral-900 shadow-md" style={{ width: box + 12, height: box + 28 }}>
        <ShotCanvas shot={best} scale={3} box={box} label={`베스트 샷: ${best.label}`} />
      </div>
      <figcaption className="text-sm">
        <span className="font-semibold">{best.label}</span> · {fmt(best.views)}회
      </figcaption>
    </figure>
  );
}

function DexGrid({ dex, thumbs, fresh, levels }: { dex: DexRecord; thumbs: Partial<Record<DexId, Thumb>>; fresh?: DexId[]; levels?: GearState["levels"] }) {
  const count = DEX.filter((d) => dex[d.id]).length;
  const [open, setOpen] = useState<PhotoShot | null>(null);
  const timer = useRef(0);
  const show = (id: DexId) => {
    const d = DEX.find((x) => x.id === id);
    const th = thumbs[id];
    if (!d || !th) return;
    const views = th.views ?? dex[id]?.views ?? 0;
    setOpen({ snap: th.snap, fx: th.fx, fy: th.fy, title: d.name, sub: `${th.day ? `Day ${th.day} · ${DAYS[th.day - 1]?.date ?? ""} · ` : ""}${fmt(views)}회` });
  };
  const press = (id: DexId) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => show(id), 450);
  };
  const release = () => window.clearTimeout(timer.current);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <section aria-labelledby="dex-title" className="space-y-2">
      <h2 id="dex-title" className="flex items-center gap-2 text-sm font-semibold">
        <BookOpen className="size-4" aria-hidden="true" /> 촬영 도감
        <span className="tabular-nums text-muted-foreground">
          {count}/{DEX.length}
        </span>
        <span className="ml-auto text-xs font-normal text-muted-foreground">사진을 꾹 눌러 크게 보기</span>
      </h2>
      <div className="h-1.5 overflow-hidden rounded-sm bg-muted" role="meter" aria-label="도감 수집률" aria-valuemin={0} aria-valuemax={DEX.length} aria-valuenow={count}>
        <div className="h-full bg-primary" style={{ width: `${(count / DEX.length) * 100}%` }} />
      </div>
      <PhotoViewer shot={open} onClose={() => setOpen(null)} />
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {DEX.map((d) => {
          const got = dex[d.id];
          const th = thumbs[d.id];
          const isNew = fresh?.includes(d.id);
          const content = (
            <>
              <div className="relative grid h-16 place-items-center overflow-hidden bg-neutral-900">
                {got && th ? (
                  <ShotCanvas shot={th} scale={2} box={64} label={`${d.name} 사진`} />
                ) : got ? (
                  <Camera className="size-6 text-white" aria-hidden="true" />
                ) : (
                  <Lock className="size-5 text-neutral-400" aria-hidden="true" />
                )}
                <span className={cn("absolute top-1 left-1 rounded-sm px-1 text-[10px] font-semibold", RARITY_CLASS[d.rarity])}>{d.rarity}</span>
                {isNew && <span className="absolute top-1 right-1 rounded-sm bg-amber-500 px-1 text-[10px] font-bold text-neutral-950">NEW</span>}
              </div>
              <div className="p-1.5 text-left">
                <p className="truncate text-xs font-semibold">{got ? d.name : "???"}</p>
                <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{d.hint}</p>
                {d.req && (
                  <ul className="mt-0.5 space-y-0.5">
                    {d.req.map((r) => {
                      const met = (levels?.[r.gear] ?? 0) >= r.lv;
                      return (
                        <li key={r.gear} className={cn("flex items-center gap-1 text-[10px] font-semibold", met ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                          {met ? <Check className="size-3" aria-hidden="true" /> : <Lock className="size-3" aria-hidden="true" />}
                          {r.name} +{r.lv}
                          <span className="sr-only">{met ? "조건 충족" : "조건 미충족"}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {got && <p className="text-[11px] tabular-nums">최고 {fmt(got.views)}회</p>}
              </div>
            </>
          );
          return (
            <li key={d.id} className={cn("overflow-hidden rounded-md border", isNew && "ring-2 ring-amber-500")}>
              {got && th ? (
                <button
                  type="button"
                  aria-label={`${d.name} 사진 크게 보기`}
                  className="block w-full select-none [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-ring"
                  onPointerDown={() => press(d.id)}
                  onPointerUp={release}
                  onPointerLeave={release}
                  onPointerCancel={release}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={(e) => e.detail === 0 && show(d.id)}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EndingPanel({ name }: { name: string }) {
  return (
    <section aria-labelledby="ending-title" className="space-y-2 rounded-lg border-2 border-amber-600 bg-card p-4">
      <h2 id="ending-title" className="text-xl font-black">잘가라, 부캉아</h2>
      <p className="text-sm">
        2026년 10월 21일, 폰툰과 그물을 따라 9시간 만에 수로를 벗어난 부캉이. 34일 동안 북항을 찾은 사람은 170만 명이 넘었어요.
      </p>
      <div className="rounded-md border bg-muted p-3 text-center">
        <p className="text-xs font-semibold tracking-widest">위 촉 장</p>
        <p className="mt-1 text-base font-bold">{name} 님</p>
        <p className="mt-1 text-sm">부캉이의 34일을 끝까지 기록한 공로로 &lsquo;부캉이 공식 직캠러&rsquo;로 위촉합니다.</p>
        <p className="mt-2 text-xs text-muted-foreground">부캉이 직캠 챌린지</p>
      </div>
    </section>
  );
}

function ResultScreen({ run, rows, mine, onRetry, onNext, onHome, dex, thumbs, gear, setGear, sound }: { run: RunResult; rows: RankEntry[]; mine?: RankEntry; onRetry: () => void; onNext: (() => void) | null; onHome: () => void; dex: DexRecord; thumbs: Partial<Record<DexId, Thumb>>; gear: GearState; setGear: (g: GearState) => void; sound: boolean }) {
  const rank = mine ? rows.indexOf(mine) + 1 : 0;
  const rate = run.shots ? Math.round((run.hits / run.shots) * 100) : 0;
  const cardRef = useRef<HTMLDivElement>(null);
  const dexCount = DEX.filter((d) => dex[d.id]).length;
  const day = DAYS[run.day - 1];
  const cleared = run.views >= day.goal;
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="space-y-5">
        <p className={cn("rounded-md px-3 py-2 text-sm font-bold", cleared ? "bg-emerald-700 text-white" : "bg-neutral-800 text-white")} role="status">
          {cleared ? `Day ${day.day} 클리어!${onNext ? " 다음 날이 열렸어요" : ""}` : `목표 미달 · ${fmt(run.views)} / ${fmt(day.goal)}회`}
        </p>
        {cleared && day.final && <EndingPanel name={run.name} />}
        <div ref={cardRef} className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground">
          <div>
            <p className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
              <span>부캉이 직캠 챌린지 · Day {day.day}</span>
              <span className="tabular-nums">2026.{day.date.replace("/", ".")}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {run.name}님의 직캠 · {day.title}
            </p>
            <h1 className="text-4xl font-black tabular-nums">{fmt(run.views)}회</h1>
            <p className="mt-1 text-lg font-semibold">{verdict(run.views)}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">광고수익 +₩{fmt(run.revenue)}</p>
          </div>
          {run.best ? <BestShotCard best={run.best} /> : <p className="text-sm">건진 사진이 없어요. 부캉이가 잠수만 했나 봐요.</p>}
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">팀 순위</dt>
              <dd className="text-lg font-bold">{rank}위</dd>
            </div>
            <div className="rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">촬영</dt>
              <dd className="text-lg font-bold tabular-nums">{run.shots}장</dd>
            </div>
            <div className="rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">성공률</dt>
              <dd className="text-lg font-bold tabular-nums">{rate}%</dd>
            </div>
          </dl>
          {run.newDex.length > 0 && (
            <p className="text-sm">
              <span className="font-semibold">새 도감 {run.newDex.length}종</span> · {run.newDex.map((id) => DEX.find((d) => d.id === id)?.name).join(", ")}
            </p>
          )}
          <p className="text-xs text-muted-foreground tabular-nums">도감 {dexCount}/{DEX.length} · #부캉이 #북항친수공원</p>
        </div>
        <PdfExportButton targetRef={cardRef} fileName={`부캉이-직캠-카드-Day${day.day}-${run.name}`}>
          결과 카드 PDF 저장
        </PdfExportButton>
        <div className="flex flex-wrap gap-2">
          {onNext && (
            <Button size="lg" onClick={onNext} autoFocus>
              <Flag aria-hidden="true" /> Day {day.day + 1}로
            </Button>
          )}
          <Button size="lg" variant={onNext ? "outline" : "default"} onClick={onRetry} autoFocus={!onNext}>
            <RotateCcw aria-hidden="true" /> {cleared ? "다시 찍기" : "재도전"}
          </Button>
          <Button size="lg" variant="outline" onClick={onHome}>
            <HomeIcon aria-hidden="true" /> 처음으로
          </Button>
        </div>
        <UpgradeShop gear={gear} setGear={setGear} sound={sound} />
      </div>
      <div className="min-w-0 space-y-8">
        <DexGrid dex={dex} thumbs={thumbs} fresh={run.newDex} levels={gear.levels} />
        <RankingTable rows={rows} highlight={mine} />
      </div>
    </div>
  );
}

export function HomePage() {
  const [screen, setScreen] = useState<Screen>("title");
  const [name, setName] = useState("");
  const [runs, setRuns] = useState<RankEntry[]>([]);
  const [last, setLast] = useState<{ run: RunResult; entry: RankEntry } | null>(null);
  const [round, setRound] = useState(0);
  const [dex, setDex] = useState<DexRecord>(loadDex);
  const [thumbs, setThumbs] = useState<Partial<Record<DexId, Thumb>>>(loadThumbs);
  const [gear, setGearState] = useState<GearState>(loadGearState);
  const [progress, setProgress] = useState<DayProgress>(loadDays);
  const [selected, setSelected] = useState(() => Math.min(34, loadDays().cleared + 1));
  const [audio, setAudioState] = useState<AudioSettings>(loadAudioSettings);

  const setAudio = useCallback((a: AudioSettings) => {
    saveAudioSettings(a);
    setAudioState(a);
  }, []);
  const setGear = useCallback((g: GearState) => {
    saveGearState(g);
    setGearState(g);
  }, []);

  const recordDex = useCallback((id: DexId, views: number, thumb: Thumb) => {
    setDex((d) => {
      const next = { ...d, [id]: { views: Math.max(views, d[id]?.views ?? 0) } };
      saveDex(next);
      return next;
    });
    setThumbs((t) => {
      const next = { ...t, [id]: thumb };
      saveThumbs(next);
      return next;
    });
  }, []);

  const rows = useMemo(() => [...TEAM_RANKING, ...runs].sort((a, b) => b.views - a.views), [runs]);

  const finish = useCallback((run: RunResult) => {
    const entry: RankEntry = { name: run.name, views: run.views, bestShot: run.best?.label ?? "-", you: true };
    setRuns((r) => [...r, entry]);
    setLast({ run, entry });
    setGearState((g) => {
      const next = { ...g, wallet: g.wallet + run.revenue };
      saveGearState(next);
      return next;
    });
    setProgress((p) => {
      const day = DAYS[run.day - 1];
      const cleared = run.views >= day.goal;
      const next: DayProgress = {
        cleared: cleared ? Math.max(p.cleared, run.day) : p.cleared,
        best: { ...p.best, [run.day]: Math.max(p.best[run.day] ?? 0, run.views) },
        ending: p.ending || (cleared && day.final),
      };
      saveDays(next);
      return next;
    });
    setScreen("result");
  }, []);

  const start = (d = selected) => {
    unlockAudio();
    setSelected(d);
    setRound((r) => r + 1);
    setScreen("play");
  };

  if (screen === "play")
    return <PlayScreen key={round} name={name.trim()} onFinish={finish} dex={dex} onDex={recordDex} gear={gear} audio={audio} setAudio={setAudio} day={DAYS[selected - 1]} />;
  if (screen === "result" && last) {
    const d = last.run.day;
    const canNext = d < 34 && last.run.views >= DAYS[d - 1].goal;
    return (
      <ResultScreen
        run={last.run}
        rows={rows}
        mine={last.entry}
        onRetry={() => start(d)}
        onNext={canNext ? () => start(d + 1) : null}
        onHome={() => {
          setSelected(Math.min(34, Math.max(d, progress.cleared + 1)));
          setScreen("title");
        }}
        dex={dex}
        thumbs={thumbs}
        gear={gear}
        setGear={setGear}
        sound={audio.sfx}
      />
    );
  }
  return <TitleScreen name={name} setName={setName} onStart={() => start()} rows={rows} dex={dex} thumbs={thumbs} gear={gear} setGear={setGear} sound={audio.sfx} progress={progress} selected={selected} onSelect={setSelected} />;
}
