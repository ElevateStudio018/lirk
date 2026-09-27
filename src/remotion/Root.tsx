import { Composition } from "remotion";
import { computeTimeline, FPS } from "@/lib/video/timing";
import { equationsLesson } from "@/lib/video/samples/equations";
import { greenhouseLesson } from "@/lib/video/samples/greenhouse";
import { LessonVideo, type LessonVideoProps } from "./LessonVideo";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "./theme";

/**
 * Remotion Studio / CLI entry. The same compositions the in-app Player uses can be
 * rendered to MP4, e.g.:
 *   npx remotion render src/remotion/index.ts Lesson out/lesson.mp4 --props='{"scenes":[...]}'
 */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Lesson"
        component={LessonVideo}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        durationInFrames={FPS * 10}
        defaultProps={{ scenes: greenhouseLesson.scenes } satisfies LessonVideoProps}
        calculateMetadata={({ props }) => ({ durationInFrames: computeTimeline(props.scenes).totalFrames })}
      />
      <Composition
        id="GreenhouseDemo"
        component={LessonVideo}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        durationInFrames={computeTimeline(greenhouseLesson.scenes).totalFrames}
        defaultProps={{ scenes: greenhouseLesson.scenes } satisfies LessonVideoProps}
      />
      <Composition
        id="EquationsDemo"
        component={LessonVideo}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        durationInFrames={computeTimeline(equationsLesson.scenes).totalFrames}
        defaultProps={{ scenes: equationsLesson.scenes } satisfies LessonVideoProps}
      />
    </>
  );
}
