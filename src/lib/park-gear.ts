import type { Gear } from "@/lib/park-engine";

export type GearId = "stick" | "powerbank" | "lens" | "shoes";
export const MAX_LV = 30;

export interface GearDef {
  id: GearId;
  name: string;
  effect: string;
  base: number;
  max: number;
  format: (v: number) => string;
}

export const GEARS: GearDef[] = [
  { id: "stick", name: "셀카봉", effect: "프레임 크기", base: 20, max: 36, format: (v) => `${Math.round((v / 20) * 100)}%` },
  { id: "powerbank", name: "보조배터리", effect: "배터리 소모", base: 1, max: 0.35, format: (v) => `${Math.round(v * 100)}%` },
  { id: "lens", name: "망원렌즈", effect: "조회수 배율", base: 1, max: 2.2, format: (v) => `×${v.toFixed(2)}` },
  { id: "shoes", name: "러닝화", effect: "이동 속도", base: 1, max: 1.55, format: (v) => `${Math.round(v * 100)}%` },
];

export const gearValue = (d: GearDef, lv: number) => d.base + (d.max - d.base) * (lv / MAX_LV);

/** Cost of one enhancement attempt from level lv. */
export const enhanceCost = (lv: number) => Math.round((400 * Math.pow(1.15, lv)) / 100) * 100;
/** Success rate from lv → lv+1: 75% at +0 down to 1% at +29. */
export const successRate = (lv: number) => Math.max(0.01, 0.75 - 0.74 * Math.pow(lv / (MAX_LV - 1), 0.6));
export const dropsOnFail = (lv: number) => lv >= 10;
export const destroyChance = (lv: number) => (lv >= 20 ? 0.05 + (lv - 20) * 0.012 : 0);
export const BOOST = 0.1;
export const BOX_PRICE = 3_000;

export type Levels = Record<GearId, number>;
export interface Items {
  ticket: number; // free attempt
  protect: number; // prevents drop/destroy once
  boost: number; // +10%p success once
}

export interface GearState {
  wallet: number;
  levels: Levels;
  items: Items;
  stickers: number;
}

export const NEW_GEAR: GearState = { wallet: 0, levels: { stick: 0, powerbank: 0, lens: 0, shoes: 0 }, items: { ticket: 1, protect: 0, boost: 1 }, stickers: 0 };

const KEY = "bukangi-gear-v2";
const OLD_KEY = "bukangi-gear-v1";
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);

export function loadGearState(): GearState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<GearState>;
      const levels = { ...NEW_GEAR.levels };
      for (const g of GEARS) levels[g.id] = num(p.levels?.[g.id], 0, MAX_LV, 0);
      return {
        wallet: num(p.wallet, 0, 1e12, 0),
        levels,
        items: { ticket: num(p.items?.ticket, 0, 9999, 0), protect: num(p.items?.protect, 0, 9999, 0), boost: num(p.items?.boost, 0, 9999, 0) },
        stickers: num(p.stickers, 0, 1e6, 0),
      };
    }
    // Migrate the old 3-step shop (each old step ≈ 5 new levels).
    const old = JSON.parse(window.localStorage.getItem(OLD_KEY) ?? "null") as { wallet?: number; levels?: Record<string, number> } | null;
    if (old) {
      const levels = { ...NEW_GEAR.levels };
      for (const g of GEARS) levels[g.id] = num((old.levels?.[g.id] ?? 0) * 5, 0, MAX_LV, 0);
      return { ...NEW_GEAR, wallet: num(old.wallet, 0, 1e12, 0), levels };
    }
  } catch {
    /* fall through */
  }
  return structuredClone(NEW_GEAR);
}

export function saveGearState(s: GearState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* progress lasts for this session */
  }
}

export function gearFrom(levels: Levels): Gear {
  const v = (id: GearId) => gearValue(GEARS.find((g) => g.id === id)!, levels[id]);
  return { frame: v("stick"), drain: v("powerbank"), lens: v("lens"), speed: v("shoes"), levels: { ...levels } };
}

export interface EnhanceOpts {
  ticket: boolean;
  protect: boolean;
  boost: boolean;
}

export type EnhanceOutcome = "success" | "fail" | "drop" | "destroy" | "saved";

export interface EnhanceResult {
  state: GearState;
  outcome: EnhanceOutcome;
  from: number;
  to: number;
  rate: number;
}

export function canEnhance(s: GearState, id: GearId, o: EnhanceOpts) {
  const lv = s.levels[id];
  if (lv >= MAX_LV) return false;
  if (o.ticket) return s.items.ticket > 0;
  return s.wallet >= enhanceCost(lv);
}

export function enhance(s: GearState, id: GearId, o: EnhanceOpts): EnhanceResult | null {
  if (!canEnhance(s, id, o)) return null;
  const lv = s.levels[id];
  const items = { ...s.items };
  let wallet = s.wallet;
  if (o.ticket) items.ticket -= 1;
  else wallet -= enhanceCost(lv);
  const useBoost = o.boost && items.boost > 0;
  if (useBoost) items.boost -= 1;
  const rate = Math.min(0.95, successRate(lv) + (useBoost ? BOOST : 0));
  const levels = { ...s.levels };
  let outcome: EnhanceOutcome;
  if (Math.random() < rate) {
    levels[id] = lv + 1;
    outcome = "success";
  } else {
    const destroy = Math.random() < destroyChance(lv);
    const harmful = destroy || dropsOnFail(lv);
    if (harmful && o.protect && items.protect > 0) {
      items.protect -= 1;
      outcome = "saved";
    } else if (destroy) {
      levels[id] = 0;
      outcome = "destroy";
    } else if (dropsOnFail(lv)) {
      levels[id] = lv - 1;
      outcome = "drop";
    } else {
      outcome = "fail";
    }
  }
  return { state: { ...s, wallet, items, levels }, outcome, from: lv, to: levels[id], rate };
}

export type Prize = { kind: "ticket" | "protect" | "boost" | "sticker" | "jackpot" | "cash"; label: string; gear?: GearId; amount?: number };

/** 부캉이 굿즈 박스: random enhancement items. */
export function openBox(s: GearState): { state: GearState; prize: Prize } | null {
  if (s.wallet < BOX_PRICE) return null;
  const st: GearState = { ...s, wallet: s.wallet - BOX_PRICE, items: { ...s.items }, levels: { ...s.levels } };
  const r = Math.random();
  let prize: Prize;
  if (r < 0.03) {
    const cands = GEARS.filter((g) => st.levels[g.id] < MAX_LV);
    const g = cands[Math.floor(Math.random() * cands.length)];
    if (g) {
      st.levels[g.id] += 1;
      prize = { kind: "jackpot", label: `잭팟! ${g.name} 즉시 +1`, gear: g.id };
    } else {
      st.wallet += 10_000;
      prize = { kind: "cash", label: "잭팟! 광고수익 ₩10,000", amount: 10_000 };
    }
  } else if (r < 0.15) {
    st.items.protect += 1;
    prize = { kind: "protect", label: "파괴방지권 1장" };
  } else if (r < 0.35) {
    st.items.boost += 1;
    prize = { kind: "boost", label: "확률 부스터 (+10%p) 1개" };
  } else if (r < 0.6) {
    st.items.ticket += 1;
    prize = { kind: "ticket", label: "무료 강화권 1장" };
  } else if (r < 0.75) {
    st.wallet += 1_500;
    prize = { kind: "cash", label: "협찬금 ₩1,500", amount: 1_500 };
  } else {
    st.stickers += 1;
    prize = { kind: "sticker", label: "꽝… 부캉이 스티커 1장" };
  }
  return { state: st, prize };
}

export const revenueFor = (views: number) => Math.floor(views / 20);
