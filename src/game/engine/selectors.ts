import type { GameState, PlayerId, Star, StarId } from "../types";

import { BASE_JUMP_RANGE, BASE_LANE_BUILD_RANGE } from "../constants";
import { distance } from "../math";

export function findPlayer(state: GameState, playerId: PlayerId) {
  return state.players.find((player) => player.id === playerId) ?? null;
}

export function getConnectedLane(state: GameState, aStarId: StarId, bStarId: StarId) {
  return (
    state.hyperspaceLanes.find(
      (lane) =>
        (lane.aStarId === aStarId && lane.bStarId === bStarId) ||
        (lane.aStarId === bStarId && lane.bStarId === aStarId),
    ) ?? null
  );
}

export function getEnemyPlayers(state: GameState, playerId: PlayerId) {
  return state.players.filter((player) => player.id !== playerId);
}

export function getJumpRange(star: Star) {
  return BASE_JUMP_RANGE + star.upgrades.factory * 18;
}

export function getStar(state: GameState, starId: StarId) {
  return state.stars.find((star) => star.id === starId) ?? null;
}

export function isDestinationReachable(state: GameState, source: Star, destination: Star) {
  return (
    distance(source, destination) <= getJumpRange(source) ||
    getConnectedLane(state, source.id, destination.id) !== null
  );
}

export function isLaneBuildReachable(source: Star, destination: Star) {
  return distance(source, destination) <= BASE_LANE_BUILD_RANGE && source.id !== destination.id;
}

export function playerOwnsAnyStars(state: GameState, playerId: PlayerId) {
  return state.stars.some((star) => star.ownerId === playerId);
}
