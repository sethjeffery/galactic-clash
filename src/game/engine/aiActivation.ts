import type { GameState } from "../types";

export const AI_IDLE_GRACE_SECONDS = 15;

export function shouldPlanAiTurn(state: GameState) {
  return state.aiUnlockedAt !== null || state.elapsedSeconds >= AI_IDLE_GRACE_SECONDS;
}

export function unlockAi(state: GameState) {
  if (state.aiUnlockedAt !== null) {
    return state;
  }

  return {
    ...state,
    aiUnlockedAt: state.elapsedSeconds,
  };
}

export function unlockAiAfterAction(previous: GameState, next: GameState) {
  if (next === previous) {
    return previous;
  }

  return unlockAi(next);
}
