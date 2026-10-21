import { useState } from "react";
import { BatteryCharging, Footprints, Gift, Hammer, ShieldCheck, Smartphone, Sparkles, Ticket, Wallet, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  BOOST,
  BOX_PRICE,
  GEARS,
  MAX_LV,
  canEnhance,
  destroyChance,
  dropsOnFail,
  enhance,
  enhanceCost,
  gearValue,
  openBox,
  successRate,
  type EnhanceOpts,
  type GearId,
  type GearState,
} from "@/lib/park-gear";
import { playSfx } from "@/lib/park-audio";

const ICON = { stick: Smartphone, powerbank: BatteryCharging, lens: ZoomIn, shoes: Footprints } as const;
const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const pct = (r: number) => `${r >= 0.1 ? Math.round(r * 100) : (r * 100).toFixed(1)}%`;

interface Log {
  id: number;
  text: string;
  tone: "good" | "bad" | "info";
}

export function UpgradeShop({ gear, setGear, sound }: { gear: GearState; setGear: (g: GearState) => void; sound: boolean }) {
  const [opts, setOpts] = useState<EnhanceOpts>({ ticket: false, protect: false, boost: false });
  const [log, setLog] = useState<Log | null>(null);
  const sfx = (s: Parameters<typeof playSfx>[0]) => sound && playSfx(s);

  const doEnhance = (id: GearId) => {
    const def = GEARS.find((g) => g.id === id)!;
    const res = enhance(gear, id, opts);
    if (!res) return;
    setGear(res.state);
    const name = `${def.name} +${res.from}`;
    const map = {
      success: { text: `강화 성공! ${def.name} +${res.to}`, tone: "good" as const, s: "dex" as const },
      fail: { text: `강화 실패… ${name} 유지`, tone: "bad" as const, s: "miss" as const },
      drop: { text: `강화 실패! ${def.name} +${res.from} → +${res.to} 하락`, tone: "bad" as const, s: "miss" as const },
      destroy: { text: `장비 파괴!! ${def.name} +${res.from} → +0`, tone: "bad" as const, s: "end" as const },
      saved: { text: `파괴방지권 발동! ${name} 지켜냄`, tone: "info" as const, s: "hit" as const },
    }[res.outcome];
    sfx(map.s);
    setLog({ id: Date.now(), text: map.text, tone: map.tone });
    if (res.outcome === "destroy") toast.error(map.text);
    // Auto-off toggles when the item ran out.
    setOpts((o) => ({ ticket: o.ticket && res.state.items.ticket > 0, protect: o.protect && res.state.items.protect > 0, boost: o.boost && res.state.items.boost > 0 }));
  };

  const doBox = () => {
    const res = openBox(gear);
    if (!res) return;
    setGear(res.state);
    const good = res.prize.kind !== "sticker";
    sfx(res.prize.kind === "jackpot" ? "bigHit" : good ? "hit" : "miss");
    setLog({ id: Date.now(), text: `굿즈 박스: ${res.prize.label}`, tone: res.prize.kind === "jackpot" ? "good" : good ? "info" : "bad" });
    if (res.prize.kind === "jackpot") toast.success(res.prize.label);
  };

  const toggles = [
    { key: "ticket", label: "무료 강화권", icon: Ticket, count: gear.items.ticket },
    { key: "boost", label: `확률 부스터 +${Math.round(BOOST * 100)}%p`, icon: Sparkles, count: gear.items.boost },
    { key: "protect", label: "파괴방지권", icon: ShieldCheck, count: gear.items.protect },
  ] as const;

  return (
    <section aria-labelledby="shop-title" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="shop-title" className="flex items-center gap-2 text-sm font-semibold">
          <Hammer className="size-4" aria-hidden="true" /> 장비 강화소
        </h2>
        <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
          <Wallet className="size-4" aria-hidden="true" />
          <span className="sr-only">보유 광고수익</span>₩{fmt(gear.wallet)}
        </p>
      </div>

      <div className="grid gap-1.5 rounded-md border p-2.5 sm:grid-cols-3">
        {toggles.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-2">
            <Label htmlFor={`opt-${t.key}`} className="flex items-center gap-1.5 text-xs font-medium">
              <t.icon className="size-3.5" aria-hidden="true" />
              {t.label}
              <span className="tabular-nums text-muted-foreground">×{t.count}</span>
            </Label>
            <Switch id={`opt-${t.key}`} size="sm" checked={opts[t.key]} disabled={t.count === 0} onCheckedChange={(v) => setOpts((o) => ({ ...o, [t.key]: v }))} />
          </div>
        ))}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {GEARS.map((d) => {
          const lv = gear.levels[d.id];
          const max = lv >= MAX_LV;
          const Icon = ICON[d.id];
          const rate = Math.min(0.95, successRate(lv) + (opts.boost && gear.items.boost > 0 ? BOOST : 0));
          const destroy = destroyChance(lv);
          const ok = canEnhance(gear, d.id, opts);
          return (
            <li key={d.id} className="space-y-2 rounded-md border p-2.5">
              <div className="flex items-center gap-2.5">
                <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {d.name} <span className="tabular-nums">+{lv}</span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {d.effect} {d.format(gearValue(d, lv))}
                    {!max && ` → ${d.format(gearValue(d, lv + 1))}`}
                  </p>
                </div>
                <Button size="sm" disabled={max || !ok} onClick={() => doEnhance(d.id)} className="shrink-0 tabular-nums">
                  {max ? "MAX" : opts.ticket ? "강화권 사용" : `₩${fmt(enhanceCost(lv))}`}
                </Button>
              </div>
              <div className="h-1 overflow-hidden rounded-sm bg-muted" role="meter" aria-label={`${d.name} 강화 단계`} aria-valuemin={0} aria-valuemax={MAX_LV} aria-valuenow={lv}>
                <div className="h-full bg-primary" style={{ width: `${(lv / MAX_LV) * 100}%` }} />
              </div>
              {!max && (
                <p className="flex flex-wrap gap-x-2 text-[11px] tabular-nums">
                  <span className="font-semibold">성공 {pct(rate)}</span>
                  <span className={cn(dropsOnFail(lv) ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground")}>{dropsOnFail(lv) ? "실패 시 -1 하락" : "실패 시 유지"}</span>
                  {destroy > 0 && <span className="font-semibold text-red-700 dark:text-red-400">파괴 {pct(destroy)}</span>}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 rounded-md border p-2.5">
        <Gift className="size-5 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">부캉이 굿즈 박스</p>
          <p className="text-xs text-muted-foreground">강화권 · 부스터 · 파괴방지권 · 협찬금 · 잭팟(즉시 +1) · 스티커 {gear.stickers}장</p>
        </div>
        <Button size="sm" variant="outline" disabled={gear.wallet < BOX_PRICE} onClick={doBox} className="tabular-nums">
          열기 ₩{fmt(BOX_PRICE)}
        </Button>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm font-semibold">
        {log && (
          <span key={log.id} className={cn("animate-in fade-in", log.tone === "good" ? "text-emerald-700 dark:text-emerald-400" : log.tone === "bad" ? "text-red-700 dark:text-red-400" : "text-sky-700 dark:text-sky-300")}>
            {log.text}
          </span>
        )}
      </p>
    </section>
  );
}
