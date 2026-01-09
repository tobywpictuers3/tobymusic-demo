import { useEffect, useMemo, useState } from "react";
import { hybridSync, SyncUiState } from "@/lib/hybridSync";
import { Cloud, CloudOff, AlertTriangle, Loader2 } from "lucide-react";

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - t) / 1000));

  if (diffSec < 10) return "הרגע";
  if (diffSec < 60) return `לפני ${diffSec} שנ׳`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `לפני ${diffHr} ש׳`;
  const diffDay = Math.floor(diffHr / 24);
  return `לפני ${diffDay} ימים`;
}

export default function SyncStatusBadge() {
  const [state, setState] = useState<SyncUiState>(() => hybridSync.getSyncState());

  useEffect(() => {
    return hybridSync.subscribeSyncState(setState);
  }, []);

  const view = useMemo(() => {
    // Offline has priority
    if (!state.isOnline) {
      return {
        icon: <CloudOff className="w-4 h-4" />,
        text: state.lastLocalSaveAt
          ? `נשמר מקומית (${formatRelative(state.lastLocalSaveAt)}), ממתין לענן`
          : "אין חיבור — ממתין לענן",
        className: "text-yellow-300",
      };
    }

    if (state.isSyncing) {
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        text: "שומר לענן…",
        className: "text-blue-300",
      };
    }

    if (state.lastError) {
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        text: "נשמר מקומית — סנכרון לענן נכשל",
        className: "text-red-300",
        title: state.lastError,
      };
    }

    if (state.lastCloudSyncAt) {
      return {
        icon: <Cloud className="w-4 h-4" />,
        text: `הסתנכרן לענן ${formatRelative(state.lastCloudSyncAt)}`,
        className: "text-green-300",
      };
    }

    if (state.lastLocalSaveAt) {
      return {
        icon: <Cloud className="w-4 h-4" />,
        text: `נשמר מקומית ${formatRelative(state.lastLocalSaveAt)} — ממתין לענן`,
        className: "text-yellow-300",
      };
    }

    return {
      icon: <Cloud className="w-4 h-4" />,
      text: "סטטוס סנכרון לא ידוע",
      className: "text-muted-foreground",
    };
  }, [state]);

  return (
    <div
      className={`inline-flex items-center gap-2 text-xs ${view.className}`}
      title={(view as any).title || undefined}
    >
      {view.icon}
      <span>{view.text}</span>
    </div>
  );
}
