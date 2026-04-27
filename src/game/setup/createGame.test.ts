import { describe, expect, it } from "vitest";

import { AI_PLAYER_IDS, HUMAN_PLAYER_ID } from "../constants";
import { createGame } from "./createGame";

describe("createGame", () => {
  it("creates a multiplayer-capable 1v1 game by default config", () => {
    const game = createGame({
      difficulty: "admiral",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });

    expect(game.aiUnlockedAt).toBeNull();
    expect(game.players.map((player) => player.id)).toEqual([HUMAN_PLAYER_ID, AI_PLAYER_IDS[0]]);
    expect(game.players[0]?.isHuman).toBe(true);
    expect(game.players[1]?.isHuman).toBe(false);
    expect(game.stars).toHaveLength(24);
  });

  it("creates distinct AI players and starting clusters for three opponents", () => {
    const game = createGame({
      difficulty: "warlord",
      mapSize: "expansive",
      opponentCount: 3,
      winCondition: "capture_all_enemy_stars",
    });
    const playerIds = game.players.map((player) => player.id);

    expect(playerIds).toEqual([HUMAN_PLAYER_ID, ...AI_PLAYER_IDS]);
    expect(new Set(game.players.map((player) => player.color)).size).toBe(4);

    for (const player of game.players) {
      const ownedStars = game.stars.filter((star) => star.ownerId === player.id);

      expect(ownedStars).toHaveLength(3);
      expect(ownedStars.every((star) => star.forces === 38)).toBe(true);
    }
  });

  it("uses map-size presets for star count and map dimensions", () => {
    const compact = createGame({
      difficulty: "cadet",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const standard = createGame({
      difficulty: "cadet",
      mapSize: "standard",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const expansive = createGame({
      difficulty: "cadet",
      mapSize: "expansive",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });

    expect(compact.stars).toHaveLength(24);
    expect(standard.stars).toHaveLength(34);
    expect(expansive.stars).toHaveLength(48);
    expect(compact.map.width).toBeLessThan(standard.map.width);
    expect(standard.map.width).toBeLessThan(expansive.map.width);
  });
});
