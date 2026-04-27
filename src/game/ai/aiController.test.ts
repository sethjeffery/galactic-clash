import { describe, expect, it } from "vitest";

import { AI_PLAYER_IDS, HUMAN_PLAYER_ID } from "../constants";
import { createTestGame, getHumanStar, getOwnedStar, positionStar } from "../testing/factories";
import { planAiTurn } from "./aiController";

describe("aiController", () => {
  it("does not plan commands for completed games", () => {
    const game = createTestGame();

    expect(planAiTurn({ ...game, phase: "complete" })).toEqual([]);
  });

  it("plans commands for each AI opponent using that opponent's player id", () => {
    const game = createTestGame({ opponentCount: 3 });
    const humanStar = positionStar(getHumanStar(game), 0, 0);

    humanStar.forces = 20;

    AI_PLAYER_IDS.forEach((playerId, index) => {
      const star = positionStar(getOwnedStar(game, playerId), 100 + index * 40, 0);

      star.forces = 80;
    });

    const commands = planAiTurn(game);
    const dispatchPlayerIds = commands
      .filter((command) => command.type === "dispatch")
      .map((command) => command.playerId);

    expect(dispatchPlayerIds).toEqual(expect.arrayContaining([...AI_PLAYER_IDS]));
    expect(dispatchPlayerIds).not.toContain(HUMAN_PLAYER_ID);
  });

  it("does not target stars owned by the same AI player", () => {
    const game = createTestGame({ opponentCount: 2 });
    const aiOneStar = positionStar(getOwnedStar(game, AI_PLAYER_IDS[0]), 0, 0);
    const aiOneFriend = positionStar(
      game.stars.find((star) => star.ownerId === AI_PLAYER_IDS[0] && star.id !== aiOneStar.id)!,
      100,
      0,
    );
    const humanStar = positionStar(getHumanStar(game), 160, 0);

    aiOneStar.forces = 90;
    aiOneFriend.forces = 4;
    humanStar.forces = 30;

    const commands = planAiTurn(game).filter(
      (command) => command.type === "dispatch" && command.playerId === AI_PLAYER_IDS[0],
    );

    expect(commands.some((command) => command.targetStarId === aiOneFriend.id)).toBe(false);
  });
});
