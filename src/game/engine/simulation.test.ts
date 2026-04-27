import { describe, expect, it } from "vitest";

import { planAiTurn } from "../ai/aiController";
import { AI_PLAYER_ID, HUMAN_PLAYER_ID } from "../constants";
import { createGame } from "../setup/createGame";
import { dispatchFleet } from "./actions";
import { advanceGame } from "./simulation";

describe("simulation", () => {
  it("creates up to three AI opponents with their own starting clusters", () => {
    const game = createGame({
      difficulty: "cadet",
      mapSize: "standard",
      opponentCount: 3,
      winCondition: "capture_all_enemy_stars",
    });

    const aiPlayers = game.players.filter((player) => !player.isHuman);

    expect(aiPlayers).toHaveLength(3);

    for (const player of aiPlayers) {
      expect(game.stars.filter((star) => star.ownerId === player.id)).toHaveLength(3);
    }
  });

  it("captures an undefended enemy star when an overwhelming fleet arrives", () => {
    const game = createGame({
      difficulty: "cadet",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const source = game.stars.find((star) => star.ownerId === HUMAN_PLAYER_ID)!;
    const target = game.stars.find((star) => star.ownerId !== HUMAN_PLAYER_ID)!;

    source.x = 0;
    source.y = 0;
    source.forces = 100;
    target.x = 100;
    target.y = 0;
    target.forces = 4;

    const withFleet = dispatchFleet(game, source.id, target.id, 60, HUMAN_PLAYER_ID);
    let afterBattle = withFleet;

    for (let index = 0; index < 20; index += 1) {
      afterBattle = advanceGame(afterBattle, 0.5);
    }

    const captured = afterBattle.stars.find((star) => star.id === target.id);

    expect(captured?.ownerId).toBe(HUMAN_PLAYER_ID);
  });

  it("keeps rival fleets as separate attackers when they land on a contested neutral star", () => {
    const game = createGame({
      difficulty: "cadet",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const humanSource = game.stars.find((star) => star.ownerId === HUMAN_PLAYER_ID)!;
    const aiSource = game.stars.find((star) => star.ownerId === AI_PLAYER_ID)!;
    const target = game.stars.find((star) => star.ownerId === null)!;

    humanSource.x = 0;
    humanSource.y = 0;
    humanSource.forces = 100;
    aiSource.x = 0;
    aiSource.y = 80;
    aiSource.forces = 100;
    target.x = 100;
    target.y = 40;
    target.forces = 50;

    const withHumanFleet = dispatchFleet(game, humanSource.id, target.id, 20, HUMAN_PLAYER_ID);
    const withBothFleets = dispatchFleet(withHumanFleet, aiSource.id, target.id, 20, AI_PLAYER_ID);
    let afterLanding = withBothFleets;

    for (let index = 0; index < 4; index += 1) {
      afterLanding = advanceGame(afterLanding, 0.5);
    }

    const battle = afterLanding.battles.find((activeBattle) => activeBattle.starId === target.id);

    expect(battle?.defenderPlayerId).toBeNull();
    expect(battle?.attackers).toHaveLength(2);
    expect(battle?.attackers.map((attacker) => attacker.playerId).sort()).toEqual([
      AI_PLAYER_ID,
      HUMAN_PLAYER_ID,
    ]);
    expect(battle?.defenderForces).toBeLessThan(target.forces);
  });

  it("lets the AI plan a lane when surviving targets are not directly reachable", () => {
    const game = createGame({
      difficulty: "admiral",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const aiStar = game.stars.find((star) => star.ownerId === AI_PLAYER_ID)!;
    const humanStar = game.stars.find((star) => star.ownerId === HUMAN_PLAYER_ID)!;

    for (const star of game.stars) {
      star.ownerId = AI_PLAYER_ID;
      star.x = 0;
      star.y = 0;
    }

    aiStar.ownerId = AI_PLAYER_ID;
    aiStar.forces = 90;
    aiStar.x = 0;
    aiStar.y = 0;
    humanStar.ownerId = HUMAN_PLAYER_ID;
    humanStar.forces = 24;
    humanStar.x = 620;
    humanStar.y = 0;

    const commands = planAiTurn({
      ...game,
      stars: [aiStar, humanStar],
    });

    expect(commands.some((command) => command.type === "lane")).toBe(true);
  });
});
