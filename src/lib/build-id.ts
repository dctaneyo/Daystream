import { readFileSync } from "node:fs";
import path from "node:path";

let cached: string | null = null;

/**
 * The identity of the build this process is serving. A deploy's commit id is
 * preferred so a person can compare what they are running with what shipped;
 * otherwise Next's own per-build id is enough to notice a change.
 */
export function buildId(): string {
  if (cached) return cached;

  const fromPlatform = process.env.APP_BUILD_ID ?? process.env.RAILWAY_GIT_COMMIT_SHA;
  if (fromPlatform) {
    cached = fromPlatform.slice(0, 12);
    return cached;
  }

  if (process.env.NODE_ENV !== "production") {
    cached = "dev";
    return cached;
  }

  try {
    cached = readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim().slice(0, 12);
  } catch {
    cached = "unknown";
  }
  return cached;
}
