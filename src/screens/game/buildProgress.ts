import type { BuildTask, BuildTaskType, StarId } from "../../game/types";
import type { CSSProperties } from "react";

export function buildProgress(task: BuildTask, elapsedSeconds: number) {
  return Math.round(getTaskProgress(task, elapsedSeconds) * 100);
}

export function buildProgressStyle(task: BuildTask | null, elapsedSeconds: number) {
  if (!task) {
    return undefined;
  }

  return {
    "--progress": `${buildProgress(task, elapsedSeconds)}%`,
  } as CSSProperties;
}

export function getActiveBuild(buildTasks: BuildTask[] | undefined, sourceStarId: StarId, type: BuildTaskType) {
  return (buildTasks ?? []).find((task) => task.sourceStarId === sourceStarId && task.type === type) ?? null;
}

function getTaskProgress(task: BuildTask, elapsedSeconds: number) {
  const duration = task.completeAt - task.startedAt;

  if (duration <= 0) {
    return 1;
  }

  return Math.min(1, Math.max(0, (elapsedSeconds - task.startedAt) / duration));
}
