"use client";

import { useCallback } from "react";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { evaluateCheckpointLocally } from "@/lib/video/checkpoint";
import { equationsLesson } from "@/lib/video/samples/equations";
import { greenhouseLesson } from "@/lib/video/samples/greenhouse";

const LESSONS = { vaxthuseffekten: greenhouseLesson, ekvationer: equationsLesson };

export function DemoPlayer({ slug }: { slug: string }) {
  const lesson = LESSONS[slug as keyof typeof LESSONS];
  const answer = useCallback(
    async (checkpointId: string, choice: number, attempt: number) => {
      const cp = lesson.checkpoints.find((c) => c.id === checkpointId)!;
      return evaluateCheckpointLocally(cp, choice, attempt);
    },
    [lesson],
  );
  return (
    <LessonPlayer
      scenes={lesson.scenes}
      checkpoints={lesson.checkpoints.map(({ id, after_scene, question, options }) => ({ id, after_scene, question, options }))}
      pretest={lesson.pretest}
      recall={lesson.recall_prompt ? { prompt: lesson.recall_prompt, keyPoints: lesson.key_points } : null}
      answerCheckpoint={answer}
    />
  );
}
