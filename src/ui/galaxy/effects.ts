import type { GameState, StarId } from "../../game/types";
import type { BattleGroupSnapshot, OwnerTransition, ParticleBurst } from "./types";

import { NEUTRAL_COLOR } from "./constants";
import { getBattleStationPosition, getPlayerColor } from "./geometry";

export function queueBattleBursts(
  state: GameState,
  previousGroups: Map<string, BattleGroupSnapshot>,
  bursts: ParticleBurst[],
) {
  const currentGroups = new Map<string, BattleGroupSnapshot>();
  const now = performance.now();

  for (const battle of state.battles) {
    const destination = state.stars.find((star) => star.id === battle.starId);

    if (!destination) {
      continue;
    }

    battle.attackers.forEach((group, index) => {
      const position = getBattleStationPosition(state, destination, group, index, battle.attackers.length);
      currentGroups.set(group.id, {
        playerId: group.playerId,
        starId: battle.starId,
        x: position.x,
        y: position.y,
      });

      if (!previousGroups.has(group.id)) {
        bursts.push({
          color: getPlayerColor(state, group.playerId),
          duration: 540,
          kind: "arrival",
          startedAt: now,
          x: position.x,
          y: position.y,
        });
      }
    });
  }

  for (const [groupId, snapshot] of previousGroups) {
    if (currentGroups.has(groupId)) {
      continue;
    }

    const destination = state.stars.find((star) => star.id === snapshot.starId);
    const succeeded = destination?.ownerId === snapshot.playerId;

    bursts.push({
      color: getPlayerColor(state, snapshot.playerId),
      duration: succeeded ? 760 : 620,
      fromX: snapshot.x,
      fromY: snapshot.y,
      kind: succeeded ? "absorb" : "death",
      startedAt: now,
      x: succeeded && destination ? destination.x : snapshot.x,
      y: succeeded && destination ? destination.y : snapshot.y,
    });
  }

  previousGroups.clear();

  for (const [groupId, snapshot] of currentGroups) {
    previousGroups.set(groupId, snapshot);
  }
}

export function queueOwnerTransitions(
  state: GameState,
  previousOwners: Map<StarId, null | string>,
  transitions: Map<StarId, OwnerTransition>,
  bursts: ParticleBurst[],
) {
  const now = performance.now();

  for (const star of state.stars) {
    const previousOwner = previousOwners.get(star.id);

    if (previousOwner !== undefined && previousOwner !== star.ownerId) {
      const toColor = star.ownerId ? getPlayerColor(state, star.ownerId) : NEUTRAL_COLOR;

      transitions.set(star.id, {
        duration: 820,
        fromColor: previousOwner ? getPlayerColor(state, previousOwner) : NEUTRAL_COLOR,
        startedAt: now,
        toColor,
      });

      bursts.push({
        color: toColor,
        duration: 1050,
        kind: "capture",
        startedAt: now,
        x: star.x,
        y: star.y,
      });
    }

    previousOwners.set(star.id, star.ownerId);
  }
}

export function queueUpgradeBursts(
  state: GameState,
  previousLevels: Map<StarId, string>,
  bursts: ParticleBurst[],
) {
  const now = performance.now();

  for (const star of state.stars) {
    const signature = `${star.upgrades.factory}:${star.upgrades.turret}`;
    const previous = previousLevels.get(star.id);

    if (previous && previous !== signature) {
      bursts.push({
        color: star.ownerId ? getPlayerColor(state, star.ownerId) : 0xffffff,
        duration: 1350,
        kind: "upgrade",
        startedAt: now,
        x: star.x,
        y: star.y,
      });
    }

    previousLevels.set(star.id, signature);
  }
}
