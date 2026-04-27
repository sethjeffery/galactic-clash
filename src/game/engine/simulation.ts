import type { Battle, BattleGroup, BuildTask, Fleet, GameState, Star } from "../types";

import { BASE_COMBAT_RATE } from "../constants";
import { getGrowthPerSecond, getTurretMultiplier } from "./economy";
import { playerOwnsAnyStars } from "./selectors";

export function advanceGame(input: GameState, deltaSeconds: number): GameState {
  if (input.phase !== "playing") {
    return input;
  }

  const state: GameState = {
    ...input,
    battles: input.battles.map((battle) => ({
      ...battle,
      attackers: battle.attackers.map((attacker) => ({ ...attacker })),
    })),
    buildTasks: (input.buildTasks ?? []).map((task) => ({ ...task })),
    elapsedSeconds: input.elapsedSeconds + Math.max(0, Math.min(deltaSeconds, 0.5)),
    fleets: input.fleets.map((fleet) => ({ ...fleet })),
    stars: input.stars.map((star) => ({ ...star, upgrades: { ...star.upgrades } })),
  };

  growOwnedStars(state, deltaSeconds);
  completeBuildTasks(state);
  landArrivedFleets(state);
  resolveBattles(state, deltaSeconds);

  return applyWinCondition(state);
}

function applyWinCondition(state: GameState): GameState {
  if (state.config.winCondition !== "capture_all_enemy_stars") {
    return state;
  }

  const activePlayers = state.players.filter(
    (player) =>
      playerOwnsAnyStars(state, player.id) ||
      state.fleets.some((fleet) => fleet.ownerId === player.id) ||
      state.battles.some((battle) => battle.attackers.some((attacker) => attacker.playerId === player.id)),
  );

  if (activePlayers.length === 1) {
    return {
      ...state,
      phase: "complete",
      winnerId: activePlayers[0]?.id ?? null,
    };
  }

  return state;
}

function findStar(state: GameState, starId: string) {
  return state.stars.find((star) => star.id === starId);
}

function growOwnedStars(state: GameState, deltaSeconds: number) {
  const battleStarIds = new Set(state.battles.map((battle) => battle.starId));

  for (const star of state.stars) {
    if (star.ownerId && !battleStarIds.has(star.id)) {
      star.forces += getGrowthPerSecond(star) * deltaSeconds;
    }
  }
}

function landArrivedFleets(state: GameState) {
  const remainingFleets: Fleet[] = [];

  for (const fleet of state.fleets) {
    if (fleet.arrivalAt > state.elapsedSeconds) {
      remainingFleets.push(fleet);
      continue;
    }

    const destination = findStar(state, fleet.destinationStarId);

    if (!destination) {
      continue;
    }

    const battle = state.battles.find((activeBattle) => activeBattle.starId === destination.id);

    if (destination.ownerId === fleet.ownerId && !battle) {
      destination.forces += fleet.forces;
      continue;
    }

    mergeFleetIntoBattle(state, destination, fleet, battle);
  }

  state.fleets = remainingFleets;
}

function mergeFleetIntoBattle(
  state: GameState,
  destination: Star,
  fleet: Fleet,
  battle: Battle | undefined,
) {
  if (!battle) {
    state.battles.push({
      attackers: [createBattleGroup(fleet)],
      defenderForces: destination.forces,
      defenderPlayerId: destination.ownerId,
      starId: destination.id,
    });
    return;
  }

  if (battle.defenderPlayerId === fleet.ownerId) {
    battle.defenderForces += fleet.forces;
    return;
  }

  battle.attackers.push(createBattleGroup(fleet));
}

function completeBuildTasks(state: GameState) {
  const pendingTasks: BuildTask[] = [];

  for (const task of state.buildTasks ?? []) {
    if (task.completeAt > state.elapsedSeconds) {
      pendingTasks.push(task);
      continue;
    }

    const source = findStar(state, task.sourceStarId);

    if (!source || source.ownerId !== task.playerId) {
      continue;
    }

    if (task.type === "factory") {
      source.upgrades.factory += 1;
      continue;
    }

    if (task.type === "turret") {
      source.upgrades.turret += 1;
      continue;
    }

    if (task.type === "hyperspace_lane" && task.targetStarId) {
      const destination = findStar(state, task.targetStarId);
      const laneExists = state.hyperspaceLanes.some(
        (lane) =>
          (lane.aStarId === task.sourceStarId && lane.bStarId === task.targetStarId) ||
          (lane.aStarId === task.targetStarId && lane.bStarId === task.sourceStarId),
      );

      if (destination && !laneExists) {
        state.hyperspaceLanes.push({
          aStarId: source.id,
          bStarId: destination.id,
          id: `lane-${task.id}`,
          ownerId: task.playerId,
        });
      }
    }
  }

  state.buildTasks = pendingTasks;
}

function resolveBattles(state: GameState, deltaSeconds: number) {
  const unresolvedBattles: Battle[] = [];

  for (const battle of state.battles) {
    const star = findStar(state, battle.starId);

    if (!star) {
      continue;
    }

    const defenderMultiplier = getTurretMultiplier(star);
    const activeAttackers = battle.attackers.filter((attacker) => attacker.forces > 0);

    if (activeAttackers.length === 0) {
      star.forces = Math.max(1, battle.defenderForces);
      continue;
    }

    for (const attacker of activeAttackers) {
      attacker.forces -= BASE_COMBAT_RATE * defenderMultiplier * deltaSeconds;
    }

    battle.defenderForces -= BASE_COMBAT_RATE * activeAttackers.length * deltaSeconds;
    battle.attackers = battle.attackers.filter((attacker) => attacker.forces > 0);

    if (battle.defenderForces > 0 && battle.attackers.length > 0) {
      star.forces = Math.max(0, battle.defenderForces);
      unresolvedBattles.push(battle);
      continue;
    }

    if (battle.attackers.length === 0) {
      star.forces = Math.max(1, battle.defenderForces);
      continue;
    }

    const remainingByPlayer = groupAttackersByPlayer(battle.attackers);
    const strongest = [...remainingByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];

    if (!strongest) {
      star.forces = 0;
      continue;
    }

    const [winnerId, winningForces] = strongest;
    const rivalForces = [...remainingByPlayer.entries()]
      .filter(([playerId]) => playerId !== winnerId)
      .reduce((total, [, forces]) => total + forces, 0);
    const finalForces = winningForces - rivalForces;

    if (finalForces > 0) {
      star.forces = finalForces;
      star.ownerId = winnerId;
      continue;
    }

    star.forces = 0;
    star.ownerId = null;
  }

  state.battles = unresolvedBattles;
}

function createBattleGroup(fleet: Fleet): BattleGroup {
  return {
    forces: fleet.forces,
    id: fleet.id,
    originStarId: fleet.originStarId,
    playerId: fleet.ownerId,
  };
}

function groupAttackersByPlayer(attackers: BattleGroup[]) {
  const forcesByPlayer = new Map<string, number>();

  for (const attacker of attackers) {
    forcesByPlayer.set(attacker.playerId, (forcesByPlayer.get(attacker.playerId) ?? 0) + attacker.forces);
  }

  return forcesByPlayer;
}
