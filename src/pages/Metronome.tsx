import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import { MetronomeEngine, type SubdivisionMode, type MetronomeSound } from "@/lib/metronom/MetronomeEngine";
import { TunerEngine, type TunerState, type NoteMeasurement } from "@/lib/tuner/TunerEngine";

const SOUND_LABELS: Record<MetronomeSound, string> = {
  classic_click: "Classic Click",
  woodblock: "Woodblock",
  clave: "Clave",
  rimshot: "Rimshot",
  cowbell: "Cowbell",
  hihat: "Hi-Hat",
  beep_sine: "Beep (Sine)",
  beep_square: "Beep (Square)",
  soft_tick: "Soft Tick",
  digital_pop: "Digital Pop",
};

const SUB_LABELS: Record<SubdivisionMode, string> = {
  quarter: "רבעים",
  eighths: "שמיניות",
  triplets: "שלישיות",
  sixteenths: "שש עשרה",
  swing: "סווינג",
};

function centsColor(cents: number) {
  const abs = Math.abs(cents);
  if (abs <= 5) return "text-emerald-400";
  if (abs <= 15) return "text-yellow-300";
  return "text-red-400";
}

export default function Metronome() {
  // ----- Metronome engine -----
  const m = useMemo(() => MetronomeEngine.getInstance(), []);
  const [mRunning, setMRunning] = useState<boolean>(m.getRunning());
  const [mSettings, setMSettings] = useState(m.getSettings());

  // ----- Tuner engine (shared for tuner + duration tab) -----
  const t = useMemo(() => new TunerEngine(), []);
  const [tState, setTState] = useState<TunerState>({ status: "idle" });
  const [durations, setDurations] = useState<Array<NoteMeasurement & { id: string; createdAt: number }>>([]);

  useEffect(() => {
    // metronome callbacks
    m.setOnState((running) => setMRunning(running));
    // keep settings in sync after UI changes
    setMSettings(m.getSettings());

    // tuner callbacks
    t.setOnState(setTState);
    t.setOnNoteMeasured((x) => {
      setDurations((prev) => [
        { ...x, id: crypto.randomUUID(), createdAt: Date.now() },
        ...prev,
      ]);
    });

    return () => {
      m.setOnState(null);
      m.setOnTick(null);
      t.stop();
    };
  }, [m, t]);

  // Visual metronome dot
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    m.setOnTick((e) => {
      // blink on each main beat
      if (e.isMainBeat) {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 90);
      }
    });
    return () => m.setOnTick(null);
  }, [m]);

  const startMetronome = async () => {
    await m.start();
    setMSettings(m.getSettings());
  };
  const stopMetronome = () => {
    m.stop();
    setMSettings(m.getSettings());
  };

  const setBpm = (v: number) => {
    m.setBpm(v, true);
    setMSettings(m.getSettings());
  };
  const setBeatsPerBar = (v: number) => {
    m.setBeatsPerBar(v, true);
    setMSettings(m.getSettings());
  };
  const setAccentEvery = (v: number) => {
    m.setAccentEvery(v, true);
    setMSettings(m.getSettings());
  };
  const setSubdivision = (v: SubdivisionMode) => {
    m.setSubdivision(v, true);
    setMSettings(m.getSettings());
  };
  const setSound = (v: MetronomeSound) => {
    m.setSound(v, true);
    setMSettings(m.getSettings());
  };
  const setVolume = (v: number) => {
    m.setVolume(v, true);
    setMSettings(m.getSettings());
  };

  const startMic = async () => {
    await t.start({
      fluteMinHz: 180,
      fluteMaxHz: 2600,
      minClarity: 0.58,
      absoluteMinRms: 0.004,
      rmsFactor: 2.0,
      attackMs: 40,
      releaseMs: 150,
      minNoteMs: 90,
    });
  };
  const stopMic = () => t.stop();

  const tunerRunning = tState.status === "running";
  const tunerNoSignal = tState.status === "no_signal";
  const tunerDenied = tState.status === "permission_denied";
  const tunerErr = tState.status === "error";

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="text-right">העזרים של טובי</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="metronome" className="space-y-6">
            <TabsList className="gap-2">
              <TabsTrigger value="metronome">מטרונום</TabsTrigger>
              <TabsTrigger value="tuner">טיונר</TabsTrigger>
              <TabsTrigger value="duration">מדידת אורך צליל</TabsTrigger>
            </TabsList>

            {/* ---------------- METRONOME TAB ---------------- */}
            <TabsContent value="metronome" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-white/10 bg-black/20">
                  <CardHeader>
                    <CardTitle className="text-right">שליטה</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-right">
                        <div className="text-sm text-white/70">סטטוס</div>
                        <div className="text-white">{mRunning ? "פועל" : "מוכן"}</div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={startMetronome} disabled={mRunning}>
                          התחל
                        </Button>
                        <Button variant="secondary" onClick={stopMetronome} disabled={!mRunning}>
                          עצור
                        </Button>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/70">BPM</div>
                        <div className="text-white tabular-nums">{mSettings.bpm}</div>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={220}
                        value={mSettings.bpm}
                        onChange={(e) => setBpm(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="text-right">
                        <div className="text-sm text-white/70">מספר פעימות בתיבה</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.beatsPerBar}
                          onChange={(e) => setBeatsPerBar(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">AccentEvery</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.accentEvery}
                          onChange={(e) => setAccentEvery(Number(e.target.value))}
                        >
                          <option value={0}>ללא</option>
                          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                            <option key={n} value={n}>
                              כל {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">חלוקה פנימית</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.subdivision}
                          onChange={(e) => setSubdivision(e.target.value as SubdivisionMode)}
                        >
                          {Object.keys(SUB_LABELS).map((k) => (
                            <option key={k} value={k}>
                              {SUB_LABELS[k as SubdivisionMode]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">סאונד</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.sound}
                          onChange={(e) => setSound(e.target.value as MetronomeSound)}
                        >
                          {Object.keys(SOUND_LABELS).map((k) => (
                            <option key={k} value={k}>
                              {SOUND_LABELS[k as MetronomeSound]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/70">עוצמה</div>
                        <div className="text-white tabular-nums">{Math.round(mSettings.volume * 100)}%</div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(mSettings.volume * 100)}
                        onChange={(e) => setVolume(Number(e.target.value) / 100)}
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-black/20">
                  <CardHeader>
                    <CardTitle className="text-right">תצוגה</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-white/70 text-sm">נקודה</div>
                      <div className={`h-3 w-3 rounded-full ${blink ? "bg-amber-300" : "bg-white/20"}`} />
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-right">
                      <div className="text-white/70 text-sm">Beat</div>
                      <div className="text-white text-lg">
                        {mRunning ? "פועל — עקבי אחרי הנקודה" : "לחצי התחל"}
                      </div>
                      <div className="text-white/50 text-xs mt-2">
                        טיפ: כדי לשמור על AudioContext פעיל, התחלה/עצירה חייבת להיות בלחיצה.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---------------- TUNER TAB ---------------- */}
            <TabsContent value="tuner" className="space-y-6">
              <Card className="border-white/10 bg-black/20">
                <CardHeader>
                  <CardTitle className="text-right">טיונר</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <div className="text-sm text-white/70">סטטוס</div>
                      <div className="text-white">
                        {tState.status === "idle" && "מוכן"}
                        {tState.status === "starting" && "מבקש הרשאת מיקרופון..."}
                        {tunerRunning && "מזהה תו"}
                        {tunerNoSignal && "אין אות מספיק חזק/יציב"}
                        {tunerDenied && "אין הרשאה למיקרופון"}
                        {tunerErr && `שגיאה: ${tState.message}`}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={startMic} disabled={tState.status === "starting" || tunerRunning}>
                        הפעל מיקרופון
                      </Button>
                      <Button variant="secondary" onClick={stopMic} disabled={tState.status === "idle"}>
                        עצור
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">תו</div>
                      <div className="text-3xl text-white font-semibold">
                        {tunerRunning ? tState.note : "--"}
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">תדירות</div>
                      <div className="text-3xl text-white font-semibold">
                        {tunerRunning ? `${tState.hz.toFixed(1)} Hz` : "--"}
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">סטייה (cents)</div>
                      <div className={`text-3xl font-semibold ${tunerRunning ? centsColor(tState.cents) : "text-white"}`}>
                        {tunerRunning ? (tState.cents > 0 ? `+${tState.cents}` : `${tState.cents}`) : "--"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------------- DURATION TAB ---------------- */}
            <TabsContent value="duration" className="space-y-6">
              <Card className="border-white/10 bg-black/20">
                <CardHeader>
                  <CardTitle className="text-right">מדידת אורך צליל</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <div className="text-sm text-white/70">הקלטה</div>
                      <div className="text-white">
                        {tState.status === "idle" && "כדי למדוד — הפעילי מיקרופון בלשונית טיונר (או כאן)"}
                        {tState.status === "starting" && "מבקש הרשאה..."}
                        {tunerRunning && "מקשיב ומודד (אוטומטי)"}
                        {tunerNoSignal && "אין אות מספיק יציב"}
                        {tunerDenied && "אין הרשאה למיקרופון"}
                        {tunerErr && `שגיאה: ${tState.message}`}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={startMic} disabled={tState.status === "starting" || tunerRunning}>
                        הפעל מיקרופון
                      </Button>
                      <Button variant="secondary" onClick={stopMic} disabled={tState.status === "idle"}>
                        עצור
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setDurations([])}
                        disabled={durations.length === 0}
                      >
                        נקה רשימה
                      </Button>
                    </div>
                  </div>

                  {durations.length === 0 ? (
                    <div className="text-right text-white/60 text-sm">עדיין אין תוצאות.</div>
                  ) : (
                    <div className="space-y-2">
                      {durations.slice(0, 30).map((n, idx) => (
                        <div
                          key={n.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <div className="text-white/70 text-sm">#{durations.length - idx}</div>
                          <div className="text-white font-semibold tabular-nums">{n.durationSec.toFixed(2)} שנ׳</div>
                          <div className="text-white/60 text-sm tabular-nums">
                            {typeof n.lastHz === "number" ? `${Math.round(n.lastHz)} Hz` : ""}
                          </div>
                        </div>
                      ))}
                      {durations.length > 30 && (
                        <div className="text-right text-white/50 text-xs">
                          מציג 30 אחרונים מתוך {durations.length}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-right text-xs text-white/50">
                    הערה: המדידה מתבססת על זיהוי תדר “אמיתי” (לא נשימות/רעש חדר) עם ספי יציבות + עוצמה.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
