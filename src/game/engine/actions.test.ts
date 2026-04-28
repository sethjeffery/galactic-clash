import { describe, expect, it } from "vitest";

import { AI_PLAYER_ID, BASE_FLEET_SPEED, HYPERSPACE_LANE_MULTIPLIER, HUMAN_PLAYER_ID } from "../constants";
import { createTestGame, getAiStar, getHumanStar, getNeutralStar, positionStar } from "../testing/factories";
import {
  dispatchFleet,
  startFactoryBuild,
  startHyperspaceLaneBuild,
  startTurretBuild,
} from "./actions";
import { factoryCost, laneBuildCost, turretCost } from "./economy";

describe("actions", () => {
  it("dispatches a fleet, clamps forces to the source reserve, and preserves one force", () => {
    const game = createTestGame();
    const source = positionStar(getHumanStar(game), 0, 0);
    const target = positionStar(getNeutralStar(game), 100, 0);
    source.forces = 10;

    const next = dispatchFleet(game, source.id, target.id, 100, HUMAN_PLAYER_ID);

    expect(next.fleets).toHaveLength(1);
    expect(next.fleets[0]?.forces).toBe(9);
    expect(next.fleets[0]?.arrivalAt).toBeCloseTo(100 / BASE_FLEET_SPEED);
    expect(next.stars.find((star) => star.id === source.id)?.forces).toBe(1);
  });

  it("rejects dispatches from enemy stars or unreachable targets", () => {
    const game = createTestGame();
    const source = positionStar(getHumanStar(game), 0, 0);
    const target = positionStar(getAiStar(game), 1_200, 0);

    expect(dispatchFleet(game, source.id, target.id, 10, AI_PLAYER_ID)).toBe(game);
    expect(dispatchFleet(game, source.id, target.id, 10, HUMAN_PLAYER_ID)).toBe(game);
  });

  it("uses hyperspace lane speed when dispatching along a lane", () => {
    const game = createTestGame();
    const source = positionStar(getHumanStar(game), 0, 0);
    const target = positionStar(getAiStar(game), 900, 0);
    source.forces = 80;

    const withLane = {
      ...game,
      hyperspaceLanes: [
        {
          aStarId: source.id,
          bStarId: target.id,
          id: "lane-test",
          ownerId: HUMAN_PLAYER_ID,
        },
      ],
    };
    const next = dispatchFleet(withLane, source.id, target.id, 20, HUMAN_PLAYER_ID);

    expect(next.fleets[0]?.arrivalAt).toBeCloseTo(900 / (BASE_FLEET_SPEED * HYPERSPACE_LANE_MULTIPLIER));
  });

  it("starts factory, turret, and lane build tasks with costs paid up front", () => {
    const game = createTestGame();
    const source = positionStar(getHumanStar(game), 0, 0);
    const target = positionStar(getNeutralStar(game), 320, 0);
    source.forces = 120;

    const factoryState = startFactoryBuild(game, source.id, HUMAN_PLAYER_ID);
    const afterFactory = factoryState.stars.find((star) => star.id === source.id)!;
    const turretState = startTurretBuild(factoryState, source.id, HUMAN_PLAYER_ID);
    const afterTurret = turretState.stars.find((star) => star.id === source.id)!;
    const laneState = startHyperspaceLaneBuild(turretState, source.id, target.id, HUMAN_PLAYER_ID);
    const afterLane = laneState.stars.find((star) => star.id === source.id)!;

    expect(factoryState.buildTasks[0]).toMatchObject({
      cost: factoryCost(source),
      playerId: HUMAN_PLAYER_ID,
      sourceStarId: source.id,
      type: "factory",
    });
    expect(afterFactory.forces).toBe(120 - factoryCost(source));
    expect(turretState.buildTasks[1]).toMatchObject({
      cost: turretCost(afterFactory),
      type: "turret",
    });
    expect(afterTurret.forces).toBe(afterFactory.forces - turretCost(afterFactory));
    expect(laneState.buildTasks[2]).toMatchObject({
      cost: laneBuildCost(afterTurret, target),
      targetStarId: target.id,
      type: "hyperspace_lane",
    });
    expect(afterLane.forces).toBe(afterTurret.forces - laneBuildCost(afterTurret, target));
  });

  it("rejects duplicate active builds of the same type", () => {
    const game = createTestGame();
    const source = getHumanStar(game);
    source.forces = 100;

    const first = startFactoryBuild(game, source.id, HUMAN_PLAYER_ID);
    const second = startFactoryBuild(first, source.id, HUMAN_PLAYER_ID);

    expect(second).toBe(first);
    expect(second.buildTasks).toHaveLength(1);
  });

  it("blocks dispatches and new builds from stars under siege", () => {
    const game = createTestGame();
    const source = positionStar(getHumanStar(game), 0, 0);
    const target = positionStar(getNeutralStar(game), 100, 0);
    source.forces = 100;
    const underSiege = {
      ...game,
      battles: [
        {
          attackers: [
            {
              forces: 12,
              id: "attack-1",
              originStarId: target.id,
              playerId: AI_PLAYER_ID,
            },
          ],
          defenderForces: source.forces,
          defenderPlayerId: HUMAN_PLAYER_ID,
          starId: source.id,
        },
      ],
    };

    expect(dispatchFleet(underSiege, source.id, target.id, 20, HUMAN_PLAYER_ID)).toBe(underSiege);
    expect(startFactoryBuild(underSiege, source.id, HUMAN_PLAYER_ID)).toBe(underSiege);
    expect(startTurretBuild(underSiege, source.id, HUMAN_PLAYER_ID)).toBe(underSiege);
    expect(startHyperspaceLaneBuild(underSiege, source.id, target.id, HUMAN_PLAYER_ID)).toBe(underSiege);
  });
});
