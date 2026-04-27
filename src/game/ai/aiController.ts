import type { Difficulty, GameState, PlayerId, Star } from "../types";

import {
  dispatchFleet,
  startFactoryBuild,
  startHyperspaceLaneBuild,
  startTurretBuild,
} from "../engine/actions";
import { factoryCost, laneBuildCost, turretCost } from "../engine/economy";
import {
  getConnectedLane,
  getStar,
  isDestinationReachable,
  isLaneBuildReachable,
} from "../engine/selectors";
import { distance } from "../math";

export type AiCommand = AiDispatchCommand | AiUpgradeCommand;

interface AiAttackPlan extends AiDispatchCommand {
  priority: number;
}

interface AiDispatchCommand {
  forces: number;
  playerId: PlayerId;
  sourceStarId: string;
  targetStarId: string;
  type: "dispatch";
}

interface AiUpgradeCommand {
  playerId: PlayerId;
  targetStarId?: string;
  starId: string;
  type: "factory" | "lane" | "turret";
}

const DIFFICULTY_FACTOR: Record<Difficulty, number> = {
  admiral: 1.08,
  cadet: 0.86,
  warlord: 1.24,
};

export function runAiTurn(state: GameState) {
  if (state.phase !== "playing") {
    return state;
  }

  let next = state;

  for (const player of next.players.filter((candidate) => !candidate.isHuman)) {
    const ownedStars = next.stars
      .filter((star) => star.ownerId === player.id)
      .sort((a, b) => b.forces - a.forces);

    for (const star of ownedStars.slice(0, 4)) {
      const current = getStar(next, star.id);

      if (!current) {
        continue;
      }

      next = maybeUpgrade(next, current, player.id);
      next = maybeAttack(next, current, player.id);
    }
  }

  return next;
}

export function planAiTurn(state: GameState): AiCommand[] {
  if (state.phase !== "playing") {
    return [];
  }

  return state.players
    .filter((player) => !player.isHuman)
    .flatMap((player) => planAiTurnForPlayer(state, player.id));
}

function planAiTurnForPlayer(state: GameState, playerId: PlayerId) {
  const commands: AiCommand[] = [];
  const ownedStars = state.stars
    .filter((star) => star.ownerId === playerId)
    .sort((a, b) => b.forces - a.forces);
  const attackCommands = ownedStars
    .map((star) => planAttack(state, star, playerId))
    .filter((command): command is AiAttackPlan => command !== null)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, getAttackLimit(state.config.difficulty));

  commands.push(...attackCommands);

  const usedSourceIds = new Set(attackCommands.map((command) => command.sourceStarId));

  for (const star of ownedStars) {
    if (usedSourceIds.has(star.id)) {
      continue;
    }

    const laneCommand = planLane(state, star, playerId);

    if (laneCommand) {
      commands.push(laneCommand);
      usedSourceIds.add(star.id);
      continue;
    }

    const upgradeCommand = planUpgrade(state, star, playerId);

    if (upgradeCommand) {
      commands.push(upgradeCommand);
      usedSourceIds.add(star.id);
    }

    if (commands.length >= 8) {
      break;
    }
  }

  return commands;
}

function maybeAttack(state: GameState, star: Star, playerId: PlayerId) {
  const command = planAttack(state, star, playerId);

  if (!command) {
    return state;
  }

  return dispatchFleet(state, command.sourceStarId, command.targetStarId, command.forces, playerId);
}

function maybeUpgrade(state: GameState, star: Star, playerId: PlayerId) {
  const command = planUpgrade(state, star, playerId);

  if (!command) {
    return state;
  }

  if (command.type === "factory") {
    return startFactoryBuild(state, command.starId, playerId);
  }

  if (command.type === "lane" && command.targetStarId) {
    return startHyperspaceLaneBuild(state, command.starId, command.targetStarId, playerId);
  }

  return startTurretBuild(state, command.starId, playerId);
}

function planAttack(state: GameState, star: Star, playerId: PlayerId): AiAttackPlan | null {
  const difficultyFactor = DIFFICULTY_FACTOR[state.config.difficulty];
  const threshold = 26 / difficultyFactor;

  if (star.forces < threshold) {
    return null;
  }

  const target = state.stars
    .filter((candidate) => candidate.ownerId !== playerId)
    .filter((candidate) => isDestinationReachable(state, star, candidate))
    .sort((a, b) => scoreTarget(star, b) - scoreTarget(star, a))[0];

  if (!target) {
    return null;
  }

  const sendRatio = Math.min(0.78, 0.48 + difficultyFactor * 0.12);

  return {
    forces: star.forces * sendRatio,
    playerId,
    priority: scoreTarget(star, target),
    sourceStarId: star.id,
    targetStarId: target.id,
    type: "dispatch",
  };
}

function planLane(state: GameState, star: Star, playerId: PlayerId): AiUpgradeCommand | null {
  if (state.stars.some((candidate) => candidate.ownerId !== playerId && isDestinationReachable(state, star, candidate))) {
    return null;
  }

  const target = state.stars
    .filter((candidate) => candidate.ownerId !== playerId)
    .filter((candidate) => isLaneBuildReachable(star, candidate))
    .filter((candidate) => getConnectedLane(state, star.id, candidate.id) === null)
    .sort((a, b) => laneScore(star, b) - laneScore(star, a))[0];

  if (!target || star.forces < laneBuildCost(star, target) + 8) {
    return null;
  }

  return {
    playerId,
    starId: star.id,
    targetStarId: target.id,
    type: "lane",
  };
}

function planUpgrade(state: GameState, star: Star, playerId: PlayerId): AiUpgradeCommand | null {
  if (star.forces > factoryCost(star) + 22 && star.upgrades.factory < 3) {
    return { playerId, starId: star.id, type: "factory" };
  }

  const frontier = state.stars.some(
    (candidate) =>
      candidate.ownerId !== playerId &&
      distance(candidate, star) < 440 &&
      candidate.forces > star.forces * 0.55,
  );

  if (frontier && star.forces > turretCost(star) + 16 && star.upgrades.turret < 2) {
    return { playerId, starId: star.id, type: "turret" };
  }

  return null;
}

function scoreTarget(source: Star, target: Star) {
  const ownershipScore = target.ownerId === null ? 22 : 42;
  const economyScore = target.resourceEfficiency * 18;
  const defensePenalty = target.forces * 1.25;
  const distancePenalty = distance(source, target) * 0.06;

  return ownershipScore + economyScore - defensePenalty - distancePenalty;
}

function laneScore(source: Star, target: Star) {
  const ownershipScore = target.ownerId === null ? 12 : 36;
  const economyScore = target.resourceEfficiency * 14;
  const defensePenalty = target.forces * 0.55;
  const distancePenalty = distance(source, target) * 0.035;

  return ownershipScore + economyScore - defensePenalty - distancePenalty;
}

function getAttackLimit(difficulty: Difficulty) {
  if (difficulty === "warlord") {
    return 7;
  }

  if (difficulty === "admiral") {
    return 5;
  }

  return 4;
}
