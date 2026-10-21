import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PdfExportButton } from "@/components/pdf-export-button";
import { render, type Game } from "@/lib/park-engine";

export interface PhotoShot {
  snap: Game;
  fx: number;
  fy: number;
  title: string;
  sub: string;
}

const CROP = 120; // map pixels around the frame
const SCALE = 4;

/** Shows a dex shot large, inline (PDF capture must not sit inside an overlay), as a photo card the user can save. */
export function PhotoViewer({ shot, onClose }: { shot: PhotoShot | null; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [png, setPng] = useState<string | null>(null);

  useEffect(() => {
    setPng(null);
    if (!shot) return;
    const id = window.requestAnimationFrame(() => {
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.translate(Math.round(CROP / 2 - shot.fx), Math.round(CROP / 2 - shot.fy));
      render(ctx, shot.snap);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Long-press the <img> on mobile to save natively, or use the download button.
      setPng(ref.current?.toDataURL("image/png") ?? null);
    });
    return () => window.cancelAnimationFrame(id);
  }, [shot]);

  if (!shot) return null;
  const safeName = shot.title.replace(/[^\p{L}\p{N}_-]+/gu, "-");
  return (
    <section aria-label={`${shot.title} 사진 보기`} className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{shot.title}</h3>
        <Button size="icon-sm" variant="ghost" aria-label="사진 닫기" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <div ref={cardRef} className="mx-auto max-w-xs overflow-hidden rounded-md border bg-[#0b1d26]">
        <canvas
          ref={ref}
          width={CROP * SCALE}
          height={CROP * SCALE}
          data-aether-canvas-purpose="non-drawing"
          role="img"
          aria-label={`${shot.title} 사진`}
          className={png ? "hidden" : "block aspect-square w-full [image-rendering:pixelated]"}
        />
        {png && <img src={png} alt={`${shot.title} 사진`} className="block aspect-square w-full [image-rendering:pixelated]" />}
        <div className="flex items-end justify-between gap-2 px-3 py-2 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{shot.title}</p>
            <p className="truncate text-xs text-sky-200">{shot.sub}</p>
          </div>
          <p className="shrink-0 text-xs font-bold text-yellow-300">#부캉이 #북항친수공원</p>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">사진을 길게 눌러 기기에 저장할 수 있어요</p>
      <div className="flex flex-wrap justify-center gap-2">
        <a href={png ?? undefined} download={`부캉이-${safeName}.png`} aria-disabled={!png} className={buttonVariants({ variant: "default" })}>
          <Download aria-hidden="true" /> PNG 저장
        </a>
        <PdfExportButton targetRef={cardRef} fileName={`부캉이-${safeName}`}>
          사진 카드 PDF 저장
        </PdfExportButton>
      </div>
    </section>
  );
}
