import { describe, expect, it } from "vitest";

import { planAiTurn } from "../ai/aiController";
import { AI_PLAYER_ID, HUMAN_PLAYER_ID } from "../constants";
import { createGame } from "../setup/createGame";
import {
  dispatchFleet,
  startFactoryBuild,
  startHyperspaceLaneBuild,
  startTurretBuild,
} from "./actions";
import { factoryDuration, laneBuildDuration, turretDuration } from "./economy";
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

  it("reinforces a friendly star when a fleet arrives without a battle", () => {
    const game = createGame({
      difficulty: "cadet",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const [source, target] = game.stars.filter((star) => star.ownerId === HUMAN_PLAYER_ID);

    expect(source).toBeDefined();
    expect(target).toBeDefined();

    source!.x = 0;
    source!.y = 0;
    source!.forces = 50;
    target!.x = 100;
    target!.y = 0;
    target!.forces = 12;

    const withFleet = dispatchFleet(game, source!.id, target!.id, 20, HUMAN_PLAYER_ID);
    const afterArrival = advanceBy(withFleet, 2);

    expect(afterArrival.fleets).toHaveLength(0);
    expect(afterArrival.stars.find((star) => star.id === target!.id)?.forces).toBeGreaterThan(31);
  });

  it("adds defender-owned arrivals to active battle defenses", () => {
    const game = createGame({
      difficulty: "cadet",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const humanSource = game.stars.find((star) => star.ownerId === HUMAN_PLAYER_ID)!;
    const humanTarget = game.stars.find(
      (star) => star.ownerId === HUMAN_PLAYER_ID && star.id !== humanSource.id,
    )!;

    humanSource.forces = 40;
    humanTarget.forces = 15;

    const withFleet = dispatchFleet(
      {
        ...game,
        battles: [
          {
            attackers: [
              {
                forces: 30,
                id: "battle-ai",
                originStarId: "enemy-origin",
                playerId: AI_PLAYER_ID,
              },
            ],
            defenderForces: 15,
            defenderPlayerId: HUMAN_PLAYER_ID,
            starId: humanTarget.id,
          },
        ],
      },
      humanSource.id,
      humanTarget.id,
      10,
      HUMAN_PLAYER_ID,
    );
    const arrived = advanceGame(
      {
        ...withFleet,
        fleets: withFleet.fleets.map((fleet) => ({ ...fleet, arrivalAt: withFleet.elapsedSeconds })),
      },
      0.1,
    );

    expect(arrived.battles[0]?.defenderForces).toBeGreaterThan(15);
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

  it("completes factory, turret, and lane builds on schedule", () => {
    const game = createGame({
      difficulty: "cadet",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const source = game.stars.find((star) => star.ownerId === HUMAN_PLAYER_ID)!;
    const target = game.stars.find((star) => star.ownerId === null)!;

    source.x = 0;
    source.y = 0;
    source.forces = 200;
    target.x = 300;
    target.y = 0;

    const withFactory = startFactoryBuild(game, source.id, HUMAN_PLAYER_ID);
    const withTurret = startTurretBuild(withFactory, source.id, HUMAN_PLAYER_ID);
    const withLane = startHyperspaceLaneBuild(withTurret, source.id, target.id, HUMAN_PLAYER_ID);
    const completeAt = Math.max(
      factoryDuration(source),
      turretDuration(source),
      laneBuildDuration(source, target),
    );
    const completed = advanceBy(withLane, completeAt + 0.1);
    const completedSource = completed.stars.find((star) => star.id === source.id);

    expect(completed.buildTasks).toHaveLength(0);
    expect(completedSource?.upgrades.factory).toBe(1);
    expect(completedSource?.upgrades.turret).toBe(1);
    expect(completed.hyperspaceLanes).toHaveLength(1);
  });

  it("does not complete the game while a defeated player still has a fleet in flight", () => {
    const game = createGame({
      difficulty: "cadet",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const humanStar = game.stars.find((star) => star.ownerId === HUMAN_PLAYER_ID)!;
    const aiStar = game.stars.find((star) => star.ownerId === AI_PLAYER_ID)!;
    const pendingFleetGame = {
      ...game,
      fleets: [
        {
          arrivalAt: 100,
          departedAt: 0,
          destinationStarId: humanStar.id,
          forces: 10,
          id: "fleet-ai",
          originStarId: aiStar.id,
          ownerId: AI_PLAYER_ID,
        },
      ],
      stars: game.stars.map((star) =>
        star.ownerId === AI_PLAYER_ID ? { ...star, ownerId: HUMAN_PLAYER_ID } : star,
      ),
    };

    const next = advanceGame(pendingFleetGame, 0.5);

    expect(next.phase).toBe("playing");
    expect(next.winnerId).toBeNull();
  });

  it("marks the sole active player as winner when no enemies have stars, fleets, or battles", () => {
    const game = createGame({
      difficulty: "cadet",
      mapSize: "compact",
      opponentCount: 1,
      winCondition: "capture_all_enemy_stars",
    });
    const conquered = {
      ...game,
      stars: game.stars.map((star) =>
        star.ownerId === AI_PLAYER_ID ? { ...star, ownerId: HUMAN_PLAYER_ID } : star,
      ),
    };
    const completed = advanceGame(conquered, 0.1);

    expect(completed.phase).toBe("complete");
    expect(completed.winnerId).toBe(HUMAN_PLAYER_ID);
  });
});

function advanceBy(game: ReturnType<typeof createGame>, seconds: number) {
  let next = game;
  let remainingSeconds = seconds;

  while (remainingSeconds > 0) {
    const step = Math.min(0.5, remainingSeconds);

    next = advanceGame(next, step);
    remainingSeconds -= step;
  }

  return next;
}
