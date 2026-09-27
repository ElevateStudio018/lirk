"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { AnimatePresence, motion } from "framer-motion";
import {
  Captions,
  CaptionsOff,
  Brain,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CheckpointResult, PlayerCheckpoint } from "@/lib/video/checkpoint";
import type { Pretest, Scene } from "@/lib/video/schema";
import { computeTimeline, FPS, sceneIndexAtFrame } from "@/lib/video/timing";
import { getDefaultTTSProvider, SilentTTSProvider, type TTSProvider } from "@/lib/video/tts";
import { LessonVideo } from "@/remotion/LessonVideo";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "@/remotion/theme";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

type Props = {
  scenes: Scene[];
  checkpoints: PlayerCheckpoint[];
  answerCheckpoint: (checkpointId: string, choice: number, attempt: number) => Promise<CheckpointResult>;
  /** Guess-first question shown before the lesson starts (pretesting effect). */
  pretest?: Pretest | null;
  /** Free recall before the summary scene; compared against the key points. */
  recall?: { prompt: string; keyPoints: string[] } | null;
  onProgress?: (progress: number, completed: boolean) => void;
  onComplete?: () => void;
  className?: string;
};

type Phase =
  | { kind: "pretest" }
  | { kind: "recall"; text: string; submitted: boolean }
  | { kind: "main" }
  | { kind: "checkpoint"; cp: PlayerCheckpoint; attempt: number; result: CheckpointResult | null; pending: boolean; error: string | null }
  | { kind: "micro"; cp: PlayerCheckpoint; scenes: Scene[]; ended: boolean };

function fmt(frames: number) {
  const s = Math.floor(frames / FPS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LessonPlayer({ scenes, checkpoints, answerCheckpoint, pretest, recall, onProgress, onComplete, className }: Props) {
  const playerRef = useRef<PlayerRef>(null);
  const microRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { timings, totalFrames } = useMemo(() => computeTimeline(scenes), [scenes]);

  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [captions, setCaptions] = useState(true);
  const [pretestChoice, setPretestChoice] = useState<number | null>(null);
  const [voice, setVoice] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [phase, setPhase] = useState<Phase>(pretest ? { kind: "pretest" } : { kind: "main" });

  const tts = useRef<TTSProvider>(new SilentTTSProvider());
  const [ttsAvailable, setTtsAvailable] = useState(false);
  useEffect(() => {
    tts.current = getDefaultTTSProvider();
    const available = tts.current.id !== "silent";
    setTtsAvailable(available);
    // Redundancy principle: when the voice reads the narration, the same text on screen competes with the visuals.
    if (available) setCaptions(false);
    const provider = tts.current;
    return () => provider.cancel();
  }, []);

  // Frame at which each checkpoint triggers: the end of its scene.
  const cpFrames = useMemo(
    () =>
      checkpoints
        .map((cp) => {
          const t = timings[Math.min(cp.after_scene, timings.length - 1)];
          // Pause just before the scene's exit transition so the content is still visible.
          return { cp, frame: t.from + Math.max(1, t.frames - 12) };
        })
        .sort((a, b) => a.frame - b.frame),
    [checkpoints, timings],
  );
  // Free recall happens at the end of the scene before the summary.
  const recallFrame = useMemo(() => {
    if (!recall || scenes.length < 3 || scenes[scenes.length - 1].type !== "summary") return null;
    const t = timings[scenes.length - 2];
    return t.from + Math.max(1, t.frames - 12);
  }, [recall, scenes, timings]);
  const recallDone = useRef(false);
  const answered = useRef(new Set<string>());
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const sceneIndex = sceneIndexAtFrame(timings, frame);
  const currentScene = scenes[sceneIndex];

  // ---- voice-over ------------------------------------------------------------
  const lastSpoken = useRef(-1);
  const speakScene = useCallback(
    (idx: number) => {
      if (!voice) return;
      lastSpoken.current = idx;
      void tts.current.speak(scenes[idx].narration, { rate, lang: "sv-SE" });
    },
    [voice, rate, scenes],
  );
  useEffect(() => {
    if (phase.kind !== "main" || !playing || !voice) return;
    if (sceneIndex !== lastSpoken.current) {
      const t = timings[sceneIndex];
      // Only start narration near the beginning of a scene so it stays in sync.
      if (frame - t.from < t.frames * 0.35) speakScene(sceneIndex);
      else lastSpoken.current = sceneIndex;
    }
  }, [sceneIndex, playing, voice, phase.kind, frame, timings, speakScene]);
  useEffect(() => {
    if (!playing) {
      tts.current.cancel();
      lastSpoken.current = -1;
    }
  }, [playing]);
  useEffect(() => {
    if (!voice) tts.current.cancel();
  }, [voice]);

  // ---- progress reporting ------------------------------------------------------
  const lastReported = useRef(0);
  useEffect(() => {
    if (!onProgress) return;
    const p = frame / Math.max(1, totalFrames - 1);
    if (p - lastReported.current >= 0.15) {
      lastReported.current = p;
      onProgress(p, false);
    }
  }, [frame, totalFrames, onProgress]);

  // ---- player events + checkpoint gating -------------------------------------
  useEffect(() => {
    const p = playerRef.current;
    if (!p || phase.kind !== "main") return;
    const onFrame = (e: { detail: { frame: number } }) => {
      const f = e.detail.frame;
      setFrame(f);
      const next = cpFrames.find((c) => !answered.current.has(c.cp.id));
      if (next && f >= next.frame && phaseRef.current.kind === "main") {
        p.pause();
        p.seekTo(next.frame);
        tts.current.cancel();
        const cpPhase: Phase = { kind: "checkpoint", cp: next.cp, attempt: 1, result: null, pending: false, error: null };
        phaseRef.current = cpPhase;
        setPhase(cpPhase);
        return;
      }
      if (recallFrame !== null && !recallDone.current && f >= recallFrame && !next && phaseRef.current.kind === "main") {
        p.pause();
        p.seekTo(recallFrame);
        tts.current.cancel();
        const rPhase: Phase = { kind: "recall", text: "", submitted: false };
        phaseRef.current = rPhase;
        setPhase(rPhase);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCompleted(true);
      onProgress?.(1, true);
      onComplete?.();
    };
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onEnded);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onEnded);
    };
  }, [cpFrames, recallFrame, phase.kind, onComplete, onProgress]);

  // ---- fullscreen (element fullscreen, CSS fallback for iPhone) -------------------
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* fall through to CSS fullscreen */
      }
    }
    setFullscreen((v) => !v);
  };

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (completed && frame >= totalFrames - 1) {
      p.seekTo(0);
      setCompleted(false);
    }
    if (p.isPlaying()) p.pause();
    else {
      p.play();
      // Speaking inside the click handler unlocks speech on iOS.
      const t = timings[sceneIndex];
      if (voice && frame - t.from < t.frames * 0.35) speakScene(sceneIndex);
    }
  };

  const seek = (f: number) => {
    const p = playerRef.current;
    if (!p) return;
    tts.current.cancel();
    lastSpoken.current = -1;
    p.seekTo(f);
    setFrame(f);
  };

  // ---- checkpoint answering ------------------------------------------------------
  const answer = async (choice: number) => {
    if (phase.kind !== "checkpoint" || phase.pending) return;
    setPhase({ ...phase, pending: true, error: null });
    try {
      const result = await answerCheckpoint(phase.cp.id, choice, phase.attempt);
      setPhase({ ...phase, pending: false, result });
    } catch (err) {
      setPhase({ ...phase, pending: false, error: err instanceof Error ? err.message : "Något gick fel" });
    }
  };

  const continueAfterCheckpoint = () => {
    if (phase.kind !== "checkpoint" || !phase.result) return;
    if (phase.result.decision === "insert_micro_lesson" && phase.result.remedyScenes.length) {
      setPhase({ kind: "micro", cp: phase.cp, scenes: phase.result.remedyScenes, ended: false });
      return;
    }
    resumeMain(phase.cp);
  };

  const retryCheckpoint = () => {
    if (phase.kind !== "checkpoint") return;
    setPhase({ ...phase, attempt: phase.attempt + 1, result: null });
  };

  const resumeMain = (cp: PlayerCheckpoint) => {
    answered.current.add(cp.id);
    setAnsweredIds((ids) => [...ids, cp.id]);
    setPhase({ kind: "main" });
    requestAnimationFrame(() => {
      const p = playerRef.current;
      if (!p) return;
      const at = cpFrames.find((c) => c.cp.id === cp.id)?.frame ?? frame;
      p.seekTo(Math.min(totalFrames - 1, at + 1));
      p.play();
    });
  };

  const startAfterPretest = (choice: number) => {
    setPretestChoice(choice);
    setPhase({ kind: "main" });
    requestAnimationFrame(() => {
      playerRef.current?.play();
      if (voice) speakScene(0);
    });
  };

  const finishRecall = () => {
    recallDone.current = true;
    setPhase({ kind: "main" });
    requestAnimationFrame(() => {
      const p = playerRef.current;
      if (!p || recallFrame === null) return;
      p.seekTo(Math.min(totalFrames - 1, recallFrame + 1));
      p.play();
    });
  };

  // Micro-lesson player lifecycle
  const microTimeline = useMemo(() => (phase.kind === "micro" ? computeTimeline(phase.scenes) : null), [phase]);
  useEffect(() => {
    if (phase.kind !== "micro") return;
    const p = microRef.current;
    if (!p) return;
    const onEnded = () => setPhase((ph) => (ph.kind === "micro" ? { ...ph, ended: true } : ph));
    p.addEventListener("ended", onEnded);
    p.play();
    if (voice) void tts.current.speak(phase.scenes.map((s) => s.narration).join(" "), { rate, lang: "sv-SE" });
    return () => {
      p.removeEventListener("ended", onEnded);
      tts.current.cancel();
    };
  }, [phase, voice, rate]);

  const inMicro = phase.kind === "micro";

  return (
    <div
      ref={containerRef}
      className={cn(
        "glass flex flex-col overflow-hidden rounded-card",
        fullscreen && "fixed inset-0 z-[60] rounded-none border-0 bg-black",
        className,
      )}
    >
      <div className={cn("relative bg-black", fullscreen && "flex flex-1 items-center justify-center bg-black")}>
        {inMicro && microTimeline ? (
          <div className="relative w-full">
            <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
              <Sparkles className="size-3.5" /> Mikrolektion
            </div>
            <Player
              ref={microRef}
              key={`micro-${phase.cp.id}`}
              component={LessonVideo}
              inputProps={{ scenes: phase.scenes }}
              durationInFrames={microTimeline.totalFrames}
              fps={FPS}
              compositionWidth={VIDEO_WIDTH}
              compositionHeight={VIDEO_HEIGHT}
              playbackRate={rate}
              style={{ width: "100%", aspectRatio: `${VIDEO_WIDTH} / ${VIDEO_HEIGHT}` }}
              acknowledgeRemotionLicense
            />
          </div>
        ) : (
          <Player
            ref={playerRef}
            component={LessonVideo}
            inputProps={{ scenes }}
            durationInFrames={totalFrames}
            fps={FPS}
            compositionWidth={VIDEO_WIDTH}
            compositionHeight={VIDEO_HEIGHT}
            playbackRate={rate}
            clickToPlay={false}
            style={{ width: "100%", aspectRatio: `${VIDEO_WIDTH} / ${VIDEO_HEIGHT}`, maxHeight: fullscreen ? "calc(100dvh - 160px)" : undefined }}
            acknowledgeRemotionLicense
          />
        )}
        {phase.kind === "main" && !playing && frame === 0 && !completed && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 grid place-items-center bg-black/20 transition-colors hover:bg-black/30"
            aria-label="Spela lektionen"
          >
            <span className="glass-strong grid size-16 place-items-center rounded-full text-ink sm:size-20">
              <Play className="ml-1 size-7 sm:size-9" fill="currentColor" />
            </span>
          </button>
        )}
      </div>

      {captions && phase.kind === "main" && currentScene && (
        <p className={cn("min-h-[3.5rem] border-t border-border px-4 py-3 text-[15px] leading-snug text-text sm:px-5", fullscreen && "border-white/10 bg-black text-white")} aria-live="polite">
          {currentScene.narration}
        </p>
      )}

      <AnimatePresence mode="wait">
        {phase.kind === "pretest" && pretest && (
          <motion.div key="pretest" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border-t border-border p-4 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Gissa först</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">{pretest.question}</h3>
            <p className="mt-1 text-sm text-muted">Gissa innan du tittar – då blir hjärnan nyfiken och minns förklaringen bättre, även om du gissar fel. Svaret kommer efter lektionen.</p>
            <div className="mt-4 grid gap-2">
              {pretest.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => startAfterPretest(i)}
                  className="rounded-md border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-[15px] font-medium text-ink transition-colors hover:border-ink"
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {phase.kind === "recall" && recall && (
          <motion.div key="recall" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("border-t border-border p-4 sm:p-6", fullscreen && "max-h-[50dvh] overflow-y-auto")}>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              <Brain className="size-3.5" /> Hämta ur minnet
            </p>
            <h3 className="mt-1 text-lg font-semibold text-ink">{recall.prompt}</h3>
            <p className="mt-1 text-sm text-muted">Att själv plocka fram det du just lärt dig är det bästa sättet att få det att fastna – mycket bättre än att titta igen. Det gör inget om du inte minns allt.</p>
            <textarea
              value={phase.text}
              onChange={(e) => setPhase({ ...phase, text: e.target.value })}
              disabled={phase.submitted}
              rows={4}
              placeholder="Skriv med egna ord…"
              className="mt-4 w-full rounded-md border border-white/10 bg-white/[0.05] px-4 py-3 text-[15px] text-ink placeholder:text-subtle focus:border-white/40 focus:outline-none"
            />
            {phase.submitted ? (
              <div className="mt-4 rounded-lg bg-info-soft p-4">
                <p className="font-semibold text-ink">Jämför med det viktigaste:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text">
                  {recall.keyPoints.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-muted">Titta extra på det du missade i sammanfattningen.</p>
                <Button size="sm" className="mt-3" onClick={finishRecall}>
                  Visa sammanfattningen
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setPhase({ ...phase, submitted: true })} disabled={!phase.text.trim()}>
                  Jämför
                </Button>
                <Button size="sm" variant="ghost" onClick={finishRecall}>
                  Hoppa över
                </Button>
              </div>
            )}
          </motion.div>
        )}
        {phase.kind === "main" && completed && pretest && pretestChoice !== null && (
          <motion.div key="pretest-reveal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="border-t border-border p-4 sm:p-6">
            <div className={cn("rounded-lg p-4", pretestChoice === pretest.correct_index ? "bg-good-soft" : "bg-info-soft")}>
              <p className="font-semibold text-ink">Din gissning innan lektionen: {pretest.options[pretestChoice]}</p>
              <p className="mt-1 text-sm text-text">
                {pretestChoice === pretest.correct_index ? "Du gissade rätt! " : `Rätt svar: ${pretest.options[pretest.correct_index]}. `}
                {pretest.explanation}
              </p>
            </div>
          </motion.div>
        )}
        {phase.kind === "checkpoint" && (
          <motion.div
            key={`cp-${phase.cp.id}-${phase.attempt}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("border-t border-border p-4 sm:p-6", fullscreen && "max-h-[50dvh] overflow-y-auto")}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Kontrollfråga</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">{phase.cp.question}</h3>
            <div className="mt-4 grid gap-2">
              {phase.cp.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={phase.pending || phase.result !== null}
                  onClick={() => answer(i)}
                  className="rounded-md border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-[15px] font-medium text-ink transition-colors hover:border-ink disabled:cursor-default disabled:hover:border-border"
                >
                  {opt}
                </button>
              ))}
            </div>
            {phase.error && <p className="mt-3 text-sm text-bad">{phase.error}</p>}
            {phase.result && (
              <div className={cn("mt-4 rounded-lg p-4", phase.result.correct ? "bg-good-soft" : "bg-bad-soft")}>
                <p className={cn("flex items-center gap-2 font-semibold", phase.result.correct ? "text-good" : "text-bad")}>
                  {phase.result.correct ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                  {phase.result.correct ? "Rätt!" : "Inte riktigt"}
                </p>
                <p className="mt-1 text-sm text-text">{phase.result.explanation}</p>
                {phase.result.correctOption && !phase.result.correct && (
                  <p className="mt-1 text-sm text-text">
                    Rätt svar: <strong>{phase.result.correctOption}</strong>
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {phase.result.decision === "insert_micro_lesson" ? (
                    <Button size="sm" variant="brand" onClick={continueAfterCheckpoint}>
                      <Sparkles /> Se en kort förklaring
                    </Button>
                  ) : (
                    <>
                      {!phase.result.correct && (
                        <Button size="sm" variant="secondary" onClick={retryCheckpoint}>
                          <RotateCcw /> Försök igen
                        </Button>
                      )}
                      <Button size="sm" onClick={continueAfterCheckpoint}>
                        Fortsätt lektionen
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
        {phase.kind === "micro" && phase.ended && (
          <motion.div key="micro-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between gap-3 border-t border-border p-4">
            <p className="text-sm font-medium text-ink">Mikrolektionen är klar.</p>
            <Button size="sm" onClick={() => resumeMain(phase.cp)}>
              Fortsätt lektionen
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase.kind === "main" && (
        <div className={cn("flex items-center gap-1 border-t border-border px-2 py-2 sm:gap-2 sm:px-3", fullscreen && "border-white/10 bg-black text-white")}>
          <Button variant="ghost" size="icon" onClick={togglePlay} aria-label={playing ? "Pausa" : "Spela"} className={cn(fullscreen && "text-white hover:bg-white/10")}>
            {playing ? <Pause /> : <Play />}
          </Button>
          <div className="relative flex flex-1 items-center">
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={frame}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Spola"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white"
            />
            {cpFrames.map(({ cp, frame: f }) => (
              <span
                key={cp.id}
                aria-hidden
                className={cn("pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface", answeredIds.includes(cp.id) ? "bg-good" : "bg-white")}
                style={{ left: `${(f / (totalFrames - 1)) * 100}%` }}
              />
            ))}
          </div>
          <span className="hidden w-[4.5rem] shrink-0 text-center text-xs tabular-nums text-muted sm:block">
            {fmt(frame)} / {fmt(totalFrames)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-12 px-0 tabular-nums", fullscreen && "text-white hover:bg-white/10")}
            onClick={() => setRate(SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length])}
            aria-label="Hastighet"
          >
            {String(rate).replace(".", ",")}×
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCaptions((c) => !c)} aria-label={captions ? "Dölj textning" : "Visa textning"} aria-pressed={captions} className={cn(fullscreen && "text-white hover:bg-white/10")}>
            {captions ? <Captions /> : <CaptionsOff />}
          </Button>
          {ttsAvailable && (
            <Button variant="ghost" size="icon" onClick={() => setVoice((v) => !v)} aria-label={voice ? "Stäng av rösten" : "Slå på rösten"} aria-pressed={voice} className={cn(fullscreen && "text-white hover:bg-white/10")}>
              {voice ? <Volume2 /> : <VolumeX />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? "Avsluta helskärm" : "Helskärm"} className={cn(fullscreen && "text-white hover:bg-white/10")}>
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      )}
    </div>
  );
}
