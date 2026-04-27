import type { Star } from "../types";

import { BASE_FACTORY_GROWTH, BUILD_DURATIONS, UPGRADE_COSTS } from "../constants";
import { distance } from "../math";

export function factoryCost(star: Star) {
  return UPGRADE_COSTS.factoryBase + star.upgrades.factory * UPGRADE_COSTS.factoryStep;
}

export function factoryDuration(star: Star) {
  return BUILD_DURATIONS.factoryBase + star.upgrades.factory * BUILD_DURATIONS.factoryStep;
}

export function getGrowthPerSecond(star: Star) {
  return BASE_FACTORY_GROWTH * star.resourceEfficiency * (1 + star.upgrades.factory * 0.42);
}

export function getTurretMultiplier(star: Star) {
  return 1 + star.upgrades.turret * 0.42;
}

export function laneBuildCost(source: Star, destination: Star) {
  return Math.ceil(UPGRADE_COSTS.laneBase + distance(source, destination) * UPGRADE_COSTS.laneDistanceFactor);
}

export function laneBuildDuration(source: Star, destination: Star) {
  return BUILD_DURATIONS.laneBase + distance(source, destination) * BUILD_DURATIONS.laneDistanceFactor;
}

export function turretCost(star: Star) {
  return UPGRADE_COSTS.turretBase + star.upgrades.turret * UPGRADE_COSTS.turretStep;
}

export function turretDuration(star: Star) {
  return BUILD_DURATIONS.turretBase + star.upgrades.turret * BUILD_DURATIONS.turretStep;
}
