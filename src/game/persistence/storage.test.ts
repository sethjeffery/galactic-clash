import type { GameState } from "../types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestGame } from "../testing/factories";
import { loadGame, loadGameIndex, saveGame } from "./storage";

function createLocalStorageMock() {
  const values = new Map<string, string>();

  return {
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe("storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves games and indexes the most recent game id", () => {
    const game = createTestGame();

    saveGame(game);

    expect(loadGame(game.id)?.id).toBe(game.id);
    expect(loadGameIndex()).toEqual([game.id]);
  });

  it("does not duplicate game ids in the index", () => {
    const game = createTestGame();

    saveGame(game);
    saveGame({ ...game, elapsedSeconds: 4 });

    expect(loadGameIndex()).toEqual([game.id]);
    expect(loadGame(game.id)?.elapsedSeconds).toBe(4);
  });

  it("migrates older saves without aiUnlockedAt", () => {
    const game = createTestGame();
    const legacyGame = { ...game } as Partial<GameState>;

    delete legacyGame.aiUnlockedAt;
    localStorage.setItem(`galactic-clash:game:${game.id}`, JSON.stringify(legacyGame));

    expect(loadGame(game.id)?.aiUnlockedAt).toBeNull();
  });
});
