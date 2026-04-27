import type { GameConfig, GameState, PlayerId, Star } from "../types";

import { AI_PLAYER_ID, HUMAN_PLAYER_ID } from "../constants";
import { createGame } from "../setup/createGame";

export const TEST_CONFIG: GameConfig = {
  difficulty: "admiral",
  mapSize: "compact",
  opponentCount: 1,
  winCondition: "capture_all_enemy_stars",
};

export function createTestGame(config: Partial<GameConfig> = {}) {
  return createGame({
    ...TEST_CONFIG,
    ...config,
  });
}

export function getAiStar(state: GameState, playerId: PlayerId = AI_PLAYER_ID) {
  return getOwnedStar(state, playerId);
}

export function getHumanStar(state: GameState) {
  return getOwnedStar(state, HUMAN_PLAYER_ID);
}

export function getNeutralStar(state: GameState) {
  const star = state.stars.find((candidate) => candidate.ownerId === null);

  if (!star) {
    throw new Error("Expected a neutral star in test game");
  }

  return star;
}

export function getOwnedStar(state: GameState, playerId: PlayerId) {
  const star = state.stars.find((candidate) => candidate.ownerId === playerId);

  if (!star) {
    throw new Error(`Expected player ${playerId} to own a star in test game`);
  }

  return star;
}

export function positionStar(star: Star, x: number, y: number) {
  star.x = x;
  star.y = y;

  return star;
}
