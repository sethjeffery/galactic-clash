import type { GameState, PlayerId, StarId } from "../types";

import {
  BASE_FLEET_SPEED,
  DISPATCH_MINIMUM_RESERVE,
  HYPERSPACE_LANE_MULTIPLIER,
} from "../constants";
import { clamp, distance, makeId } from "../math";
import {
  factoryCost,
  factoryDuration,
  laneBuildCost,
  laneBuildDuration,
  turretCost,
  turretDuration,
} from "./economy";
import { getConnectedLane, getStar, isDestinationReachable, isLaneBuildReachable } from "./selectors";

export function startFactoryBuild(state: GameState, starId: StarId, playerId: PlayerId) {
  const star = getStar(state, starId);

  if (!star || star.ownerId !== playerId || hasActiveBuild(state, star.id, "factory")) {
    return state;
  }

  const cost = factoryCost(star);

  if (star.forces < cost) {
    return state;
  }

  return addBuildTask(state, star.id, playerId, "factory", cost, factoryDuration(star));
}

export function startHyperspaceLaneBuild(
  state: GameState,
  sourceStarId: StarId,
  destinationStarId: StarId,
  playerId: PlayerId,
) {
  const source = getStar(state, sourceStarId);
  const destination = getStar(state, destinationStarId);

  if (
    !source ||
    !destination ||
    source.ownerId !== playerId ||
    source.id === destination.id ||
    getConnectedLane(state, source.id, destination.id) ||
    hasActiveBuild(state, source.id, "hyperspace_lane") ||
    !isLaneBuildReachable(source, destination)
  ) {
    return state;
  }

  const cost = laneBuildCost(source, destination);

  if (source.forces < cost) {
    return state;
  }

  return addBuildTask(
    state,
    source.id,
    playerId,
    "hyperspace_lane",
    cost,
    laneBuildDuration(source, destination),
    destination.id,
  );
}

export function startTurretBuild(state: GameState, starId: StarId, playerId: PlayerId) {
  const star = getStar(state, starId);

  if (!star || star.ownerId !== playerId || hasActiveBuild(state, star.id, "turret")) {
    return state;
  }

  const cost = turretCost(star);

  if (star.forces < cost) {
    return state;
  }

  return addBuildTask(state, star.id, playerId, "turret", cost, turretDuration(star));
}

export function dispatchFleet(
  state: GameState,
  sourceStarId: StarId,
  destinationStarId: StarId,
  requestedForces: number,
  playerId: PlayerId,
) {
  const source = getStar(state, sourceStarId);
  const destination = getStar(state, destinationStarId);

  if (
    state.phase !== "playing" ||
    !source ||
    !destination ||
    source.ownerId !== playerId ||
    source.id === destination.id ||
    !isDestinationReachable(state, source, destination)
  ) {
    return state;
  }

  const maximumForces = Math.max(0, Math.floor(source.forces - DISPATCH_MINIMUM_RESERVE));
  const forces = clamp(Math.floor(requestedForces), 0, maximumForces);

  if (forces <= 0) {
    return state;
  }

  const lane = getConnectedLane(state, source.id, destination.id);
  const speed = BASE_FLEET_SPEED * (lane ? HYPERSPACE_LANE_MULTIPLIER : 1);
  const travelSeconds = distance(source, destination) / speed;

  return {
    ...state,
    fleets: [
      ...state.fleets,
      {
        arrivalAt: state.elapsedSeconds + travelSeconds,
        departedAt: state.elapsedSeconds,
        destinationStarId: destination.id,
        forces,
        id: makeId("fleet"),
        originStarId: source.id,
        ownerId: playerId,
      },
    ],
    stars: state.stars.map((star) =>
      star.id === source.id ? { ...star, forces: star.forces - forces } : star,
    ),
  };
}

function addBuildTask(
  state: GameState,
  starId: StarId,
  playerId: PlayerId,
  type: "factory" | "hyperspace_lane" | "turret",
  cost: number,
  duration: number,
  targetStarId?: StarId,
) {
  return {
    ...state,
    buildTasks: [
      ...(state.buildTasks ?? []),
      {
        completeAt: state.elapsedSeconds + duration,
        cost,
        id: makeId("build"),
        playerId,
        sourceStarId: starId,
        startedAt: state.elapsedSeconds,
        targetStarId,
        type,
      },
    ],
    stars: state.stars.map((star) => (star.id === starId ? { ...star, forces: star.forces - cost } : star)),
  };
}

function hasActiveBuild(
  state: GameState,
  sourceStarId: StarId,
  type: "factory" | "hyperspace_lane" | "turret",
) {
  return (state.buildTasks ?? []).some(
    (task) => task.sourceStarId === sourceStarId && task.type === type,
  );
}
