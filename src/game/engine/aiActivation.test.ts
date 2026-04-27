import { describe, expect, it } from "vitest";

import { createTestGame } from "../testing/factories";
import { AI_IDLE_GRACE_SECONDS, shouldPlanAiTurn, unlockAi, unlockAiAfterAction } from "./aiActivation";

describe("ai activation", () => {
  it("keeps AI idle before the grace period until the human acts", () => {
    const game = createTestGame();

    expect(shouldPlanAiTurn({ ...game, elapsedSeconds: AI_IDLE_GRACE_SECONDS - 0.1 })).toBe(false);
    expect(shouldPlanAiTurn({ ...game, elapsedSeconds: AI_IDLE_GRACE_SECONDS })).toBe(true);
  });

  it("unlocks AI at the current elapsed time", () => {
    const game = { ...createTestGame(), elapsedSeconds: 6.4 };
    const unlocked = unlockAi(game);

    expect(unlocked.aiUnlockedAt).toBe(6.4);
    expect(shouldPlanAiTurn(unlocked)).toBe(true);
  });

  it("only unlocks after a successful state-changing action", () => {
    const game = createTestGame();
    const changed = { ...game, fleets: [] };

    expect(unlockAiAfterAction(game, game)).toBe(game);
    expect(unlockAiAfterAction(game, changed).aiUnlockedAt).toBe(game.elapsedSeconds);
  });
});
