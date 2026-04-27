import { describe, expect, it } from "vitest";

import {
  BASE_FACTORY_GROWTH,
  BUILD_DURATIONS,
  UPGRADE_COSTS,
} from "../constants";
import { createTestGame, getHumanStar, positionStar } from "../testing/factories";
import {
  factoryCost,
  factoryDuration,
  getGrowthPerSecond,
  getTurretMultiplier,
  laneBuildCost,
  laneBuildDuration,
  turretCost,
  turretDuration,
} from "./economy";

describe("economy", () => {
  it("scales upgrade costs and durations by current level", () => {
    const game = createTestGame();
    const star = getHumanStar(game);

    star.upgrades.factory = 2;
    star.upgrades.turret = 1;

    expect(factoryCost(star)).toBe(UPGRADE_COSTS.factoryBase + UPGRADE_COSTS.factoryStep * 2);
    expect(factoryDuration(star)).toBe(BUILD_DURATIONS.factoryBase + BUILD_DURATIONS.factoryStep * 2);
    expect(turretCost(star)).toBe(UPGRADE_COSTS.turretBase + UPGRADE_COSTS.turretStep);
    expect(turretDuration(star)).toBe(BUILD_DURATIONS.turretBase + BUILD_DURATIONS.turretStep);
  });

  it("scales growth by resource efficiency and factory upgrades", () => {
    const game = createTestGame();
    const star = getHumanStar(game);

    star.resourceEfficiency = 1.5;
    star.upgrades.factory = 2;

    expect(getGrowthPerSecond(star)).toBeCloseTo(BASE_FACTORY_GROWTH * 1.5 * (1 + 2 * 0.42));
  });

  it("scales turret defense multiplier by turret upgrades", () => {
    const game = createTestGame();
    const star = getHumanStar(game);

    star.upgrades.turret = 3;

    expect(getTurretMultiplier(star)).toBeCloseTo(1 + 3 * 0.42);
  });

  it("prices and times lane builds by distance", () => {
    const game = createTestGame();
    const source = positionStar(getHumanStar(game), 0, 0);
    const target = positionStar(game.stars.find((star) => star.id !== source.id)!, 300, 400);

    expect(laneBuildCost(source, target)).toBe(
      Math.ceil(UPGRADE_COSTS.laneBase + 500 * UPGRADE_COSTS.laneDistanceFactor),
    );
    expect(laneBuildDuration(source, target)).toBeCloseTo(
      BUILD_DURATIONS.laneBase + 500 * BUILD_DURATIONS.laneDistanceFactor,
    );
  });
});
