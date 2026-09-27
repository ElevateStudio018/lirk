import { AbsoluteFill, Series } from "remotion";
import type { Scene } from "@/lib/video/schema";
import { sceneFrames } from "@/lib/video/timing";
import { SceneRenderer } from "./SceneRenderer";
import { theme } from "./theme";

export type LessonVideoProps = { scenes: Scene[] };

/** A lesson is a series of scenes; each scene's length comes from lib/video/timing. */
export function LessonVideo({ scenes }: LessonVideoProps) {
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Series>
        {scenes.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={sceneFrames(scene)} premountFor={15}>
            <SceneRenderer scene={scene} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
