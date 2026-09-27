import type { Scene } from "@/lib/video/schema";
import { BigNumberScene, EquationScene, ExampleScene, GraphScene } from "./scenes/math-scenes";
import { CauseEffectScene, ComparisonScene, ConceptScene, MisconceptionScene, ProcessScene, TimelineScene } from "./scenes/structure-scenes";
import { DefinitionScene, MemoryScene, QuestionTransitionScene, QuoteScene, SummaryScene, TitleScene } from "./scenes/text-scenes";

/** Maps a scene's `type` to its React component. */
export function SceneRenderer({ scene }: { scene: Scene }) {
  switch (scene.type) {
    case "title":
      return <TitleScene scene={scene} />;
    case "concept":
      return <ConceptScene scene={scene} />;
    case "big-number":
      return <BigNumberScene scene={scene} />;
    case "comparison":
      return <ComparisonScene scene={scene} />;
    case "timeline":
      return <TimelineScene scene={scene} />;
    case "process":
      return <ProcessScene scene={scene} />;
    case "cause-effect":
      return <CauseEffectScene scene={scene} />;
    case "equation":
      return <EquationScene scene={scene} />;
    case "graph":
      return <GraphScene scene={scene} />;
    case "quote":
      return <QuoteScene scene={scene} />;
    case "definition":
      return <DefinitionScene scene={scene} />;
    case "memory-trick":
      return <MemoryScene scene={scene} />;
    case "misconception":
      return <MisconceptionScene scene={scene} />;
    case "example":
      return <ExampleScene scene={scene} />;
    case "summary":
      return <SummaryScene scene={scene} />;
    case "question-transition":
      return <QuestionTransitionScene scene={scene} />;
  }
}
