export const HUMAN_PLAYER_ID = "human";
export const AI_PLAYER_ID = "ai-1";
export const AI_PLAYER_IDS = ["ai-1", "ai-2", "ai-3"] as const;

export const BASE_COMBAT_RATE = 5.2;
export const BASE_FACTORY_GROWTH = 0.34;
export const BASE_FLEET_SPEED = 92;
export const BASE_JUMP_RANGE = 390;
export const BASE_LANE_BUILD_RANGE = 760;
export const DISPATCH_MINIMUM_RESERVE = 1;
export const HYPERSPACE_LANE_MULTIPLIER = 2.35;

export const BUILD_DURATIONS = {
  factoryBase: 8,
  factoryStep: 2.5,
  laneBase: 4,
  laneDistanceFactor: 0.022,
  turretBase: 7,
  turretStep: 2,
} as const;

export const UPGRADE_COSTS = {
  factoryBase: 18,
  factoryStep: 11,
  laneBase: 10,
  laneDistanceFactor: 0.055,
  turretBase: 20,
  turretStep: 13,
} as const;
