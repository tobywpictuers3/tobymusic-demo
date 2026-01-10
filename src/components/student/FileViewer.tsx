import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  url: string;
};

export default function FileViewer({ open, onOpenChange, title, url }: Props) {
  const isPdf = useMemo(() => url.toLowerCase().includes(".pdf") || url.toLowerCase().includes("application/pdf"), [url]);
  const [zoom, setZoom] = useState(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{title}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}>-</Button>
              <div className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</div>
              <Button variant="outline" onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(2)))}>+</Button>
              <Button variant="outline" onClick={() => window.open(url, "_blank")}>פתח בטאב חדש</Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-auto rounded border bg-black/5">
          {isPdf ? (
            <iframe
              src={url}
              title={title}
              style={{ width: "100%", height: "70vh", border: "0" }}
            />
          ) : (
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top right" }}>
              <img src={url} alt={title} style={{ display: "block", maxWidth: "100%" }} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
