import { useState, type ReactNode, type RefObject } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Standalone replacement for the Copilot Studio App Builder PdfExportButton.
 * Captures the referenced element with html2canvas-pro and saves a 1-page PDF sized to it.
 */
export function PdfExportButton({ targetRef, fileName, children = "Download PDF" }: { targetRef: RefObject<HTMLElement | null>; fileName: string; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const el = targetRef.current;
    if (!el || busy) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: null, useCORS: true });
      const w = canvas.width / 2;
      const h = canvas.height / 2;
      const pdf = new jsPDF({ orientation: w > h ? "landscape" : "portrait", unit: "px", format: [w, h] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
      pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
    } catch {
      toast.error("PDF를 만들지 못했어요");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant="outline" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileDown aria-hidden="true" />}
      {children}
    </Button>
  );
}
