import { describe, expect, it } from "vitest";
import { compareMocks } from "@/lib/engine/compare";
import { nextStep } from "@/lib/engine/next-step";
import { hasMeaningfulText, materialTypeFor, normalizeExtractedText } from "@/lib/materials/normalize";

describe("material normalization", () => {
  it("cleans extraction artefacts without changing content", () => {
    const raw = "Klimat-\nförändringar   påverkar\r\n\n\n\nhela  jorden.­ ﬁnns";
    expect(normalizeExtractedText(raw)).toBe("Klimatförändringar påverkar\n\nhela jorden. finns");
  });
  it("recognises empty extractions", () => {
    expect(hasMeaningfulText("  [Sida 1]  ")).toBe(false);
    expect(hasMeaningfulText("Förklara hur växthuseffekten fungerar i atmosfären")).toBe(true);
  });
  it("maps uploads to material types", () => {
    expect(materialTypeFor("application/pdf", "a.pdf")).toBe("pdf");
    expect(materialTypeFor("image/jpeg", "IMG_1.jpg")).toBe("image");
    expect(materialTypeFor("", "anteckningar.md")).toBe("text");
    expect(materialTypeFor("application/zip", "x.zip")).toBeNull();
  });
});

describe("next step – 'Vad ska jag göra idag?'", () => {
  const base = { projectId: "p", readyMaterials: 0, processingMaterials: 0, diagnosticAnswered: 0, diagnosticTotal: 0, nextSession: null };
  it("walks the student through the whole loop", () => {
    expect(nextStep({ ...base, status: "collecting" }).kind).toBe("materials");
    expect(nextStep({ ...base, status: "collecting", readyMaterials: 2 }).kind).toBe("map");
    expect(nextStep({ ...base, status: "map_ready" }).kind).toBe("diagnostic");
    expect(nextStep({ ...base, status: "diagnosed" }).kind).toBe("plan");
    const s = nextStep({ ...base, status: "studying", nextSession: { id: "s1", title: "Förstå ekvationer", estimated_minutes: 22, scheduled_date: "2026-10-05", kind: "learn" } });
    expect(s).toMatchObject({ kind: "session", href: "/study/s1", minutes: 22, label: "Starta" });
    expect(nextStep({ ...base, status: "final_done" }).kind).toBe("report");
  });
});

describe("mock 1 vs final comparison", () => {
  it("finds improvements, remaining uncertainty and last-minute advice", () => {
    const topics = [
      { id: "a", title: "Albedo", importance: 5, mastery: 0.5, confidence: 0.6 },
      { id: "b", title: "Väder och klimat", importance: 4, mastery: 0.9, confidence: 0.8 },
    ];
    const r = compareMocks({
      topics,
      mock1: { total: 6, max: 20, topicScores: { a: { title: "Albedo", earned: 1, max: 10 }, b: { title: "V", earned: 5, max: 10 } }, dimensionLevels: { reasoning: [0.33, 0] } },
      final: {
        total: 14,
        max: 20,
        topicScores: { a: { title: "Albedo", earned: 5, max: 10 }, b: { title: "V", earned: 9, max: 10 } },
        dimensionLevels: { reasoning: [0.66, 1] },
        misconceptions: ["Blandar ihop albedo med växthuseffekt"],
        topFixes: ["Förklara återkopplingen i flera led"],
      },
    });
    expect(r.totalAfter).toBeGreaterThan(r.totalBefore);
    expect(r.improved.map((t) => t.topic_id)).toEqual(["a", "b"]);
    expect(r.uncertain.map((t) => t.topic_id)).toContain("a");
    expect(r.lastMinute.join(" ")).toMatch(/Albedo/);
    expect(r.dimensionChanges[0].after).toBeGreaterThan(r.dimensionChanges[0].before!);
  });
});
