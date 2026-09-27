"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, getJSON, postJSON } from "@/lib/api/client";
import type { CheckpointResult, PlayerCheckpoint } from "@/lib/video/checkpoint";
import type { LessonLearning, Scene } from "@/lib/video/schema";

type LessonView = { id: string; title: string; topicTitle: string; scenes: Scene[]; checkpoints: PlayerCheckpoint[]; learning: LessonLearning | null; watchProgress: number; completed: boolean };

export function LessonStep({ lessonId, onDone, completing }: { lessonId: string; onDone: () => void; completing: boolean }) {
  const [lesson, setLesson] = useState<LessonView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [finished, setFinished] = useState(false);

  const load = useCallback(
    () =>
      getJSON<LessonView>(`/api/lessons/${lessonId}`)
        .then((l) => {
          setError(null);
          setLesson(l);
          setFinished(l.completed);
          setProgress(l.watchProgress);
        })
        .catch((e) => setError(errorMessage(e))),
    [lessonId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const answerCheckpoint = useCallback(
    (checkpointId: string, choice: number, attempt: number) =>
      postJSON<CheckpointResult>(`/api/lessons/${lessonId}/checkpoint`, { checkpointId, choice, attempt }),
    [lessonId],
  );

  const onProgress = useCallback(
    (p: number, completed: boolean) => {
      setProgress((prev) => Math.max(prev, p));
      if (completed) setFinished(true);
      void postJSON(`/api/lessons/${lessonId}/progress`, { progress: p, completed }).catch(() => undefined);
    },
    [lessonId],
  );

  if (error)
    return (
      <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={() => void load()}><RotateCcw /> Försök igen</Button>}>
        {error}
      </Alert>
    );
  if (!lesson) return <Skeleton className="aspect-video w-full" />;

  const canContinue = finished || progress >= 0.9;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-heading font-bold text-ink sm:text-title">{lesson.title}</h1>
      <LessonPlayer
        scenes={lesson.scenes}
        checkpoints={lesson.checkpoints}
        answerCheckpoint={answerCheckpoint}
        pretest={lesson.completed ? null : lesson.learning?.pretest}
        recall={lesson.learning?.recall_prompt ? { prompt: lesson.learning.recall_prompt, keyPoints: lesson.learning.key_points } : null}
        onProgress={onProgress}
      />
      <div className="sticky bottom-4 z-10">
        <Button size="lg" block onClick={onDone} disabled={!canContinue} loading={completing} className="shadow-lg">
          {canContinue ? "Fortsätt" : "Titta klart för att fortsätta"} {canContinue && <ArrowRight />}
        </Button>
      </div>
    </div>
  );
}
