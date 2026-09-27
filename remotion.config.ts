/**
 * Remotion CLI / Studio config (npm run remotion:studio, npm run remotion:render).
 * The Next.js app uses @remotion/player and does not read this file.
 */
import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias ?? {}), "@": path.join(process.cwd(), "src") },
  },
}));
