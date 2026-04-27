import type { BattleGroup, Fleet, GameState, Player, Star, StarId } from "../../game/types";
import type { OwnerTransition } from "./types";

import { distance } from "../../game/math";
import { NEUTRAL_COLOR } from "./constants";

export function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export function getAnimatedStarColor(
  state: GameState,
  star: Star,
  transitions: Map<StarId, OwnerTransition>,
  now: number,
) {
  const transition = transitions.get(star.id);

  if (!transition) {
    return star.ownerId ? getPlayerColor(state, star.ownerId) : NEUTRAL_COLOR;
  }

  const progress = Math.min(1, (now - transition.startedAt) / transition.duration);

  if (progress >= 1) {
    transitions.delete(star.id);
    return transition.toColor;
  }

  return mixColor(transition.fromColor, transition.toColor, easeOutCubic(progress));
}

export function getBattleStationPosition(
  state: GameState,
  destination: Star,
  group: BattleGroup,
  index: number,
  groupCount: number,
) {
  const origin = state.stars.find((star) => star.id === group.originStarId);
  const direction = origin ? getUnitVector(origin, destination) : { x: -1, y: 0 };
  const perpendicular = { x: -direction.y, y: direction.x };
  const offset = (index - (groupCount - 1) / 2) * 24;

  return {
    x: destination.x - direction.x * 42 + perpendicular.x * offset,
    y: destination.y - direction.y * 42 + perpendicular.y * offset,
  };
}

export function getFleetPosition(origin: Star, destination: Star, progress: number) {
  const visibleProgress = getFleetVisibleProgress(origin, destination, progress);

  return {
    x: origin.x + (destination.x - origin.x) * visibleProgress,
    y: origin.y + (destination.y - origin.y) * visibleProgress,
  };
}

export function getFleetProgress(elapsedSeconds: number, fleet: Fleet) {
  const duration = fleet.arrivalAt - fleet.departedAt;

  if (duration <= 0) {
    return 1;
  }

  return Math.min(1, Math.max(0, (elapsedSeconds - fleet.departedAt) / duration));
}

export function getPlayerColor(state: GameState, playerId: string) {
  return state.players.find((player: Player) => player.id === playerId)?.color ?? NEUTRAL_COLOR;
}

export function getUnitVector(source: { x: number; y: number }, destination: { x: number; y: number }) {
  const length = Math.max(1, distance(source, destination));

  return {
    x: (destination.x - source.x) / length,
    y: (destination.y - source.y) / length,
  };
}

export function hasActiveOwnerTransitions(transitions: Map<StarId, OwnerTransition>) {
  const now = performance.now();

  return [...transitions.values()].some((transition) => now - transition.startedAt < transition.duration);
}

function getFleetStopProgress(origin: Star, destination: Star) {
  const travelDistance = distance(origin, destination);
  const stopDistance = Math.min(42, travelDistance * 0.45);

  return travelDistance <= 0 ? 1 : (travelDistance - stopDistance) / travelDistance;
}

function getFleetVisibleProgress(origin: Star, destination: Star, progress: number) {
  return Math.min(progress, getFleetStopProgress(origin, destination));
}

function mixColor(from: number, to: number, progress: number) {
  const fromRed = (from >> 16) & 255;
  const fromGreen = (from >> 8) & 255;
  const fromBlue = from & 255;
  const toRed = (to >> 16) & 255;
  const toGreen = (to >> 8) & 255;
  const toBlue = to & 255;
  const red = Math.round(fromRed + (toRed - fromRed) * progress);
  const green = Math.round(fromGreen + (toGreen - fromGreen) * progress);
  const blue = Math.round(fromBlue + (toBlue - fromBlue) * progress);

  return (red << 16) + (green << 8) + blue;
}
