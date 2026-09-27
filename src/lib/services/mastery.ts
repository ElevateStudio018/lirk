import "server-only";

import { estimateMastery, type Evidence } from "@/lib/engine/mastery";
import type { DB } from "@/lib/supabase/server";
import { dbError } from "./errors";

/** Recomputes mastery/confidence/pattern for topics from their full evidence history. */
export async function recomputeMastery(db: DB, topicIds: string[]) {
  const ids = [...new Set(topicIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("question_attempts")
    .select("topic_id, score, weight, source, created_at")
    .in("topic_id", ids)
    .order("created_at");
  if (error) dbError(error, "recomputeMastery.select");

  const byTopic = new Map<string, Evidence[]>();
  let lastAt = new Map<string, string>();
  for (const a of data ?? []) {
    if (!byTopic.has(a.topic_id)) byTopic.set(a.topic_id, []);
    byTopic.get(a.topic_id)!.push({ score: a.score, weight: a.weight, source: a.source as Evidence["source"], created_at: a.created_at });
    lastAt = lastAt.set(a.topic_id, a.created_at);
  }

  const results = [];
  for (const id of ids) {
    const est = estimateMastery(byTopic.get(id) ?? []);
    const { error: upErr } = await db
      .from("knowledge_topics")
      .update({
        mastery: est.mastery,
        confidence: est.confidence,
        performance_pattern: est.pattern,
        last_practiced_at: lastAt.get(id) ?? null,
      })
      .eq("id", id);
    if (upErr) dbError(upErr, "recomputeMastery.update");
    results.push({ topic_id: id, ...est });
  }
  return results;
}
