/**
 * Answers the student's only question: "Vad ska jag göra idag?"
 * Given a project's state, returns the single next action.
 */

import { friendlyDate, todayISO } from "./dates";

export type ProjectStatus =
  | "collecting"
  | "analyzing"
  | "map_ready"
  | "diagnosed"
  | "studying"
  | "mock1_done"
  | "final_done"
  | "archived";

export type NextStepInput = {
  projectId: string;
  status: ProjectStatus;
  readyMaterials: number;
  processingMaterials: number;
  diagnosticAnswered: number;
  diagnosticTotal: number;
  /** The student has answered (or skipped) the follow-up questions after the map. */
  clarified?: boolean;
  nextSession: { id: string; title: string; estimated_minutes: number; scheduled_date: string; kind: string } | null;
};

export type NextStep = {
  label: string;
  title: string;
  description: string;
  href: string;
  minutes: number | null;
  kind: "materials" | "map" | "clarify" | "diagnostic" | "plan" | "session" | "report" | "done";
};

export function nextStep(i: NextStepInput): NextStep {
  const base = `/exams/${i.projectId}`;
  switch (i.status) {
    case "collecting":
      if (i.readyMaterials === 0) {
        return {
          kind: "materials",
          label: "Lägg till underlag",
          title: "Lägg in lärarens material",
          description: "Planering, betygskriterier, anteckningar eller bilder på genomgångar.",
          href: `${base}/materials`,
          minutes: 3,
        };
      }
      return {
        kind: "map",
        label: i.processingMaterials > 0 ? "Vänta på filerna" : "Analysera underlaget",
        title: "Ta reda på vad du behöver kunna",
        description: "Vi går igenom ditt underlag och bygger en karta över allt provet kan handla om.",
        href: `${base}/materials`,
        minutes: 1,
      };
    case "analyzing":
      return {
        kind: "map",
        label: "Visa analysen",
        title: "Vi analyserar ditt underlag",
        description: "Det tar oftast under en minut.",
        href: `${base}/map`,
        minutes: null,
      };
    case "map_ready":
      if (!i.clarified) {
        return {
          kind: "clarify",
          label: "Svara på frågorna",
          title: "Några snabba frågor",
          description: "Hjälp oss förstå vad som kommer på provet, så blir pluggandet mer träffsäkert.",
          href: `${base}/clarify`,
          minutes: 2,
        };
      }
      return {
        kind: "diagnostic",
        label: i.diagnosticAnswered > 0 ? "Fortsätt testet" : "Starta testet",
        title: "Kolla vad du redan kan",
        description: "Ett kort test som inte ger betyg – det hjälper oss att lägga upp din plan.",
        href: `${base}/diagnostic`,
        minutes: 10,
      };
    case "diagnosed":
      return {
        kind: "plan",
        label: "Bygg min plan",
        title: "Skapa din studieplan",
        description: "Vi bygger en plan utifrån provdatumet och det du behöver öva mest på.",
        href: `${base}/plan`,
        minutes: 1,
      };
    case "studying":
    case "mock1_done":
      if (i.nextSession) {
        return {
          kind: "session",
          label: "Starta",
          title: i.nextSession.title,
          description:
            i.nextSession.scheduled_date <= todayISO()
              ? "Dagens pass"
              : `Planerat till ${friendlyDate(i.nextSession.scheduled_date).toLowerCase()} – du kan köra det redan nu.`,
          href: `/study/${i.nextSession.id}`,
          minutes: i.nextSession.estimated_minutes,
        };
      }
      return {
        kind: "plan",
        label: "Visa planen",
        title: "Alla pass är klara",
        description: "Snyggt jobbat! Titta igenom planen eller repetera det som känns osäkert.",
        href: `${base}/plan`,
        minutes: null,
      };
    case "final_done":
      return {
        kind: "report",
        label: "Se rapporten",
        title: "Din slutrapport",
        description: "Vad som blev bättre, vad som är osäkert och vad du ska titta på precis innan provet.",
        href: `${base}/report`,
        minutes: 5,
      };
    default:
      return { kind: "done", label: "Öppna", title: "Arkiverat prov", description: "", href: base, minutes: null };
  }
}
