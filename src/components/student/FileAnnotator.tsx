import React, { useEffect, useMemo, useRef, useState } from "react";

type PenMode = "pen" | "marker" | "eraser";

function formatA4Px(scale = 2) {
  return { w: Math.round(900 * scale), h: Math.round(1273 * scale) };
}

// --- Minimal PDF generator that embeds a JPEG image ---
async function canvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.split(",")[1] || "";
  const jpgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const pageW = 595.28;
  const pageH = 841.89;

  const imgWpx = canvas.width;
  const imgHpx = canvas.height;

  const imgAspect = imgWpx / imgHpx;
  const pageAspect = pageW / pageH;

  let drawW = pageW;
  let drawH = pageH;
  if (imgAspect > pageAspect) {
    drawW = pageW;
    drawH = pageW / imgAspect;
  } else {
    drawH = pageH;
    drawW = pageH * imgAspect;
  }

  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  const enc = new TextEncoder();
  const parts: (string | ArrayBuffer)[] = [];
  const objOffsets: number[] = [];
  const push = (p: string | Uint8Array) => parts.push(typeof p === 'string' ? p : p.buffer.slice(p.byteOffset, p.byteOffset + p.byteLength) as ArrayBuffer);
  const len = () => parts.reduce((s, p) => s + (typeof p === "string" ? enc.encode(p).length : p.byteLength), 0);

  push("%PDF-1.3\n");

  const writeObj = (objNum: number, contentPart: string | Uint8Array) => {
    objOffsets[objNum] = len();
    push(contentPart);
  };

  writeObj(1, "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  writeObj(2, "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  writeObj(
    3,
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
      pageW.toFixed(2) +
      " " +
      pageH.toFixed(2) +
      "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
  );

  objOffsets[4] = len();
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWpx} /Height ${imgHpx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBytes.length} >>\nstream\n`
  );
  push(jpgBytes);
  push("\nendstream\nendobj\n");

  const content =
    `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
  const contentBytes = enc.encode(content);
  objOffsets[5] = len();
  push(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${content}endstream\nendobj\n`);

  const xrefStart = len();
  const objCount = 6;
  let xref = `xref\n0 ${objCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < objCount; i++) {
    const off = objOffsets[i] || 0;
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${objCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(parts, { type: "application/pdf" });
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
      img.src = url;
    });
    return img;
  } finally {
    // Keep url until drawn; caller will revoke after draw
  }
}

/**
 * PDF rendering (page 1) using pdfjs-dist if available.
 * If pdfjs-dist isn't installed, we throw and caller can fallback.
 */
async function renderPdfFirstPageToCanvas(pdfBlob: Blob, targetW: number, targetH: number): Promise<HTMLCanvasElement> {
  // Lazy import — will work only if pdfjs-dist exists in project
  // @ts-ignore - pdfjs-dist may not be installed
  const pdfjs = await import("pdfjs-dist").catch(() => null);
  if (!pdfjs) throw new Error("pdfjs-dist not installed");
  
  // @ts-ignore
  const workerSrc = await import("pdfjs-dist/build/pdf.worker?url").catch(() => null);

  // @ts-ignore
  if (workerSrc?.default) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default;

  const arrayBuffer = await pdfBlob.arrayBuffer();
  // @ts-ignore
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1.0 });
  const scale = Math.min(targetW / viewport.width, targetH / viewport.height);

  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas;
}

export default function FileAnnotator(props: {
  title: string;
  source: { kind: "image" | "pdf"; blob: Blob };
  onCancel: () => void;
  onSaveNewVersion: (result: { png: Blob; pdf: Blob }) => Promise<void> | void;
}) {
  const { w, h } = useMemo(() => formatA4Px(2), []);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const inkRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<PenMode>("pen");
  const [penSize, setPenSize] = useState<number>(6);
  const [zoom, setZoom] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  const [isDrawing, setIsDrawing] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);

  const snapshotInk = () => {
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ink || !ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, w, h));
    redoStack.current = [];
  };

  const restoreInk = (img: ImageData) => {
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ink || !ctx) return;
    ctx.putImageData(img, 0, 0);
  };

  const undo = () => {
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ink || !ctx) return;
    if (undoStack.current.length === 0) return;

    redoStack.current.push(ctx.getImageData(0, 0, w, h));
    restoreInk(undoStack.current.pop()!);
  };

  const redo = () => {
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ink || !ctx) return;
    if (redoStack.current.length === 0) return;

    undoStack.current.push(ctx.getImageData(0, 0, w, h));
    restoreInk(redoStack.current.pop()!);
  };

  const clearInk = () => {
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ink || !ctx) return;
    snapshotInk();
    ctx.clearRect(0, 0, w, h);
  };

  useEffect(() => {
    let revokedUrl: string | null = null;

    (async () => {
      setLoading(true);
      try {
        const base = baseRef.current;
        const ctx = base?.getContext("2d");
        if (!base || !ctx) return;

        // White background
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);

        if (props.source.kind === "image") {
          const url = URL.createObjectURL(props.source.blob);
          revokedUrl = url;

          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
            img.src = url;
          });

          // fit image inside A4 canvas
          const imgAspect = img.width / img.height;
          const canvasAspect = w / h;

          let drawW = w;
          let drawH = h;
          if (imgAspect > canvasAspect) {
            drawW = w;
            drawH = w / imgAspect;
          } else {
            drawH = h;
            drawW = h * imgAspect;
          }

          const x = (w - drawW) / 2;
          const y = (h - drawH) / 2;
          ctx.drawImage(img, x, y, drawW, drawH);
        } else {
          // PDF: render first page to canvas (requires pdfjs-dist)
          const pdfCanvas = await renderPdfFirstPageToCanvas(props.source.blob, w, h);
          const imgAspect = pdfCanvas.width / pdfCanvas.height;
          const canvasAspect = w / h;

          let drawW = w;
          let drawH = h;
          if (imgAspect > canvasAspect) {
            drawW = w;
            drawH = w / imgAspect;
          } else {
            drawH = h;
            drawW = h * imgAspect;
          }

          const x = (w - drawW) / 2;
          const y = (h - drawH) / 2;
          ctx.drawImage(pdfCanvas, x, y, drawW, drawH);
        }
      } catch (e) {
        // If pdfjs-dist not available, user can still open in viewer but cannot flatten annotations.
        console.error(e);
        alert(
          "לא ניתן לערוך PDF כרגע (חסר pdfjs-dist בפרויקט). אפשר לערוך תמונות. אם תרצי, אוסיף לך התקנה/שימוש ב-pdfjs-dist."
        );
        props.onCancel();
      } finally {
        setLoading(false);
        if (revokedUrl) URL.revokeObjectURL(revokedUrl);
      }
    })();
  }, [props.source.blob, props.source.kind, w, h]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (w / rect.width);
    const y = (e.clientY - rect.top) * (h / rect.height);
    return { x, y };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    snapshotInk();
    setIsDrawing(true);
    last.current = getPos(e);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ctx || !last.current) return;

    const p = getPos(e);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (mode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = penSize * 2;
    } else if (mode === "marker") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(255, 205, 0, 0.35)";
      ctx.lineWidth = penSize * 2.4;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(0,0,0,0.95)";
      ctx.lineWidth = penSize;
    }

    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    last.current = p;
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    last.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const exportMergedCanvas = async (): Promise<HTMLCanvasElement> => {
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const outCtx = out.getContext("2d");
    if (!outCtx) return out;

    outCtx.drawImage(baseRef.current!, 0, 0);
    outCtx.drawImage(inkRef.current!, 0, 0);
    return out;
  };

  const save = async () => {
    const merged = await exportMergedCanvas();

    const pngBlob: Blob | null = await new Promise((resolve) =>
      merged.toBlob((b) => resolve(b), "image/png", 1)
    );
    if (!pngBlob) return;

    const pdfBlob = await canvasToPdfBlob(merged);
    await props.onSaveNewVersion({ png: pngBlob, pdf: pdfBlob });
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 600 }}>{props.title}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>כלי</div>
            <select value={mode} onChange={(e) => setMode(e.target.value as PenMode)}>
              <option value="pen">עט</option>
              <option value="marker">מרקר</option>
              <option value="eraser">מחק</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>עובי</div>
            <input type="range" min={2} max={18} value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} />
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" onClick={undo} disabled={undoStack.current.length === 0}>ביטול</button>
            <button type="button" onClick={redo} disabled={redoStack.current.length === 0}>קדימה</button>
            <button type="button" onClick={clearInk}>ניקוי</button>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}>-</button>
            <div style={{ width: 60, textAlign: "center", fontSize: 12 }}>{Math.round(zoom * 100)}%</div>
            <button type="button" onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(2)))}>+</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={props.onCancel}>השלכה</button>
          <button type="button" onClick={save} disabled={loading}>
            {loading ? "טוען..." : "שמירה כגרסה חדשה (PNG+PDF)"}
          </button>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxHeight: "70vh",
          overflow: "auto",
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 10,
          background: "rgba(0,0,0,0.02)",
          touchAction: "none",
        }}
      >
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top right", width: "fit-content" }}>
          <div style={{ position: "relative" }}>
            <canvas ref={baseRef} width={w} height={h} style={{ display: "block", width: w / 2, height: h / 2 }} />
            <canvas
              ref={inkRef}
              width={w}
              height={h}
              style={{ position: "absolute", inset: 0, width: w / 2, height: h / 2 }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
