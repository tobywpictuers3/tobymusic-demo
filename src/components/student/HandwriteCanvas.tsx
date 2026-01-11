import React, { useEffect, useMemo, useRef, useState } from "react";

export type HandwriteTemplate = "blank" | "lines" | "staff";
export type PenMode = "pen" | "marker" | "eraser";

function formatA4Px(scale = 2) {
  // A4 ratio ~ 1 : 1.414
  return { w: Math.round(900 * scale), h: Math.round(1273 * scale) };
}

function drawTemplate(ctx: CanvasRenderingContext2D, w: number, h: number, template: HandwriteTemplate) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // frame
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  // lines
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;

  if (template === "lines") {
    const top = 90;
    const gap = 64;
    for (let y = top; y < h - 90; y += gap) {
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(w - 50, y);
      ctx.stroke();
    }
  }

  if (template === "staff") {
    const left = 70;
    const right = w - 70;
    const groupTopStart = 90;
    const lineGap = 18;
    const groupGap = 90;

    for (let top = groupTopStart; top < h - 140; top += (lineGap * 4 + groupGap)) {
      for (let i = 0; i < 5; i++) {
        const y = top + i * lineGap;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

// --- Minimal PDF generator that embeds a JPEG image ---
async function canvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.split(",")[1] || "";
  const jpgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // A4 points
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

  // 1 Catalog
  writeObj(1, "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  // 2 Pages
  writeObj(2, "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  // 3 Page
  writeObj(
    3,
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
      pageW.toFixed(2) +
      " " +
      pageH.toFixed(2) +
      "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
  );

  // 4 Image
  objOffsets[4] = len();
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWpx} /Height ${imgHpx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBytes.length} >>\nstream\n`
  );
  push(jpgBytes);
  push("\nendstream\nendobj\n");

  // 5 Content stream
  const content =
    `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
  const contentBytes = enc.encode(content);
  objOffsets[5] = len();
  push(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${content}endstream\nendobj\n`);

  // xref
  const xrefStart = len();
  const objCount = 6; // 0..5
  let xref = `xref\n0 ${objCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < objCount; i++) {
    const off = objOffsets[i] || 0;
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);

  // trailer
  push(`trailer\n<< /Size ${objCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(parts, { type: "application/pdf" });
}

export default function HandwriteCanvas(props: {
  initialTemplate: HandwriteTemplate;
  initialTitle: string;
  onCancel: () => void;
  onSave: (result: { png: Blob; pdf: Blob }) => Promise<void> | void;
}) {
  const { w, h } = useMemo(() => formatA4Px(2), []);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const inkRef = useRef<HTMLCanvasElement | null>(null);

  const [template, setTemplate] = useState<HandwriteTemplate>(props.initialTemplate);
  const [mode, setMode] = useState<PenMode>("pen");
  const [penSize, setPenSize] = useState<number>(6);
  const [zoom, setZoom] = useState<number>(1);

  const [isDrawing, setIsDrawing] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Undo/Redo stacks (store snapshots of ink layer)
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);

  useEffect(() => {
    const c = baseRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    drawTemplate(ctx, w, h, template);
  }, [template, w, h]);

  const snapshotInk = () => {
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ink || !ctx) return;
    const img = ctx.getImageData(0, 0, w, h);
    undoStack.current.push(img);
    // once new action starts, redo is cleared
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

    // Current state -> redo
    const current = ctx.getImageData(0, 0, w, h);
    redoStack.current.push(current);

    // Pop last undo
    const prev = undoStack.current.pop()!;
    restoreInk(prev);
  };

  const redo = () => {
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ink || !ctx) return;

    if (redoStack.current.length === 0) return;

    // Current -> undo
    const current = ctx.getImageData(0, 0, w, h);
    undoStack.current.push(current);

    const next = redoStack.current.pop()!;
    restoreInk(next);
  };

  const clearInk = () => {
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ink || !ctx) return;

    snapshotInk();
    ctx.clearRect(0, 0, w, h);
  };

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (w / rect.width);
    const y = (e.clientY - rect.top) * (h / rect.height);
    return { x, y };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);

    // snapshot BEFORE drawing this stroke
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

    const base = baseRef.current!;
    const ink = inkRef.current!;
    outCtx.drawImage(base, 0, 0);
    outCtx.drawImage(ink, 0, 0);
    return out;
  };

  const save = async () => {
    const merged = await exportMergedCanvas();

    const pngBlob: Blob | null = await new Promise((resolve) =>
      merged.toBlob((b) => resolve(b), "image/png", 1)
    );
    if (!pngBlob) return;

    const pdfBlob = await canvasToPdfBlob(merged);

    await props.onSave({ png: pngBlob, pdf: pdfBlob });
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>סוג דף</div>
            <select value={template} onChange={(e) => setTemplate(e.target.value as HandwriteTemplate)}>
              <option value="blank">דף ריק</option>
              <option value="lines">דף שורות</option>
              <option value="staff">דף חמשות</option>
            </select>
          </div>

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
            <input
              type="range"
              min={2}
              max={18}
              value={penSize}
              onChange={(e) => setPenSize(Number(e.target.value))}
            />
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" onClick={undo} disabled={undoStack.current.length === 0}>
              ביטול
            </button>
            <button type="button" onClick={redo} disabled={redoStack.current.length === 0}>
              קדימה
            </button>
            <button type="button" onClick={clearInk}>ניקוי</button>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}>-</button>
            <div style={{ width: 60, textAlign: "center", fontSize: 12 }}>{Math.round(zoom * 100)}%</div>
            <button type="button" onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(2)))}>+</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={props.onCancel}>
            השלכה
          </button>
          <button type="button" onClick={save}>
            שמירה (PNG + PDF)
          </button>
        </div>
      </div>

      {/* Canvas Area */}
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
