import type { BattleGroup, GameState, Star, StarId } from "../../game/types";
import type { OwnerTransition, ParticleBurst, StarSelection } from "./types";

import { Container, Graphics, Text } from "pixi.js";

import { HUMAN_PLAYER_ID } from "../../game/constants";
import { getJumpRange, isDestinationReachable } from "../../game/engine/selectors";
import { distance, formatForces } from "../../game/math";
import {
  easeOutCubic,
  getAnimatedStarColor,
  getBattleStationPosition,
  getFleetPosition,
  getFleetProgress,
  getPlayerColor,
  getUnitVector,
} from "./geometry";

const MAP_TEXT_RESOLUTION = 2;

export function drawBattles(layer: Container, state: GameState) {
  for (const battle of state.battles) {
    const destination = state.stars.find((star) => star.id === battle.starId);

    if (!destination) {
      continue;
    }

    battle.attackers.forEach((group, index) => {
      drawBattleGroup(layer, state, destination, group, index, battle.attackers.length);
    });
  }
}

export function drawCommandPulse(
  layer: Container,
  state: GameState,
  selection: {
    canBuildLaneToTarget: boolean;
    canSendToTarget: boolean;
    interactionMode: "inspect" | "lane" | "send";
    selectedDestinationId: null | StarId;
    selectedSourceId: null | StarId;
  },
) {
  if (selection.interactionMode === "inspect" || !selection.selectedSourceId || !selection.selectedDestinationId) {
    return;
  }

  const source = state.stars.find((star) => star.id === selection.selectedSourceId);
  const destination = state.stars.find((star) => star.id === selection.selectedDestinationId);

  if (!source || !destination) {
    return;
  }

  if (selection.interactionMode === "lane" && !selection.canBuildLaneToTarget) {
    return;
  }

  if (selection.interactionMode === "send" && !selection.canSendToTarget) {
    return;
  }

  const pulse = new Graphics();
  const travelDistance = distance(source, destination);
  const unit = getUnitVector(source, destination);
  const phase = (performance.now() / 42) % 28;
  const color =
    selection.interactionMode === "send" ? getPlayerColor(state, source.ownerId ?? HUMAN_PLAYER_ID) : 0xffffff;

  pulse.moveTo(source.x, source.y).lineTo(destination.x, destination.y).stroke({ alpha: 0.4, color, width: 3 });

  for (let offset = phase; offset < travelDistance; offset += 28) {
    const x = source.x + unit.x * offset;
    const y = source.y + unit.y * offset;

    pulse.circle(x, y, 3.2).fill({ alpha: 0.86, color });
  }

  layer.addChild(pulse);
}

export function drawFleets(layer: Container, state: GameState, elapsedSeconds: number) {
  for (const fleet of state.fleets) {
    const origin = state.stars.find((star) => star.id === fleet.originStarId);
    const destination = state.stars.find((star) => star.id === fleet.destinationStarId);

    if (!origin || !destination) {
      continue;
    }

    const progress = getFleetProgress(elapsedSeconds, fleet);
    const position = getFleetPosition(origin, destination, progress);
    const x = position.x;
    const y = position.y;
    const color = getPlayerColor(state, fleet.ownerId);
    const fleetGraphic = new Graphics();

    fleetGraphic.circle(x, y, 10).fill(color).circle(x, y, 20).stroke({ alpha: 0.35, color, width: 2 });
    layer.addChild(fleetGraphic);

    const text = new Text({
      resolution: MAP_TEXT_RESOLUTION,
      style: { fill: 0xdde8f8, fontFamily: "Inter, system-ui", fontSize: 12 },
      text: formatForces(fleet.forces),
    });
    text.position.set(x + 12, y - 8);
    layer.addChild(text);
  }
}

export function drawHyperspaceLanes(layer: Container, state: GameState) {
  const lanes = new Graphics();

  for (const lane of state.hyperspaceLanes) {
    const a = state.stars.find((star) => star.id === lane.aStarId);
    const b = state.stars.find((star) => star.id === lane.bStarId);

    if (!a || !b) {
      continue;
    }

    const color = getPlayerColor(state, lane.ownerId);
    lanes
      .moveTo(a.x, a.y)
      .lineTo(b.x, b.y)
      .stroke({ alpha: 0.58, color, width: 4 })
      .stroke({ alpha: 0.22, color: 0xffffff, width: 1 });
  }

  layer.addChild(lanes);
}

export function drawParticleBursts(layer: Container, bursts: ParticleBurst[]) {
  const now = performance.now();
  const activeBursts = bursts.filter((burst) => now - burst.startedAt < burst.duration);
  bursts.length = 0;
  bursts.push(...activeBursts);

  for (const burst of activeBursts) {
    const progress = (now - burst.startedAt) / burst.duration;
    const eased = easeOutCubic(progress);
    const particleCount = burst.kind === "upgrade" ? 34 : burst.kind === "capture" ? 30 : 20;
    const graphics = new Graphics();

    if (burst.kind === "upgrade" || burst.kind === "capture") {
      const radius = (burst.kind === "upgrade" ? 92 : 70) * eased;
      const alpha = Math.max(0, 0.82 * (1 - progress));

      graphics
        .circle(burst.x, burst.y, radius)
        .stroke({ alpha, color: burst.color, width: burst.kind === "upgrade" ? 5 : 4 })
        .circle(burst.x, burst.y, radius * 0.58)
        .stroke({ alpha: alpha * 0.5, color: 0xffffff, width: 2 });
    }

    for (let index = 0; index < particleCount; index += 1) {
      const angle = index * 2.399 + burst.startedAt * 0.001;
      const originX = burst.fromX ?? burst.x;
      const originY = burst.fromY ?? burst.y;
      const spread =
        burst.kind === "upgrade" ? 82 : burst.kind === "capture" ? 58 : burst.kind === "death" ? 42 : 22;
      const distanceFromCenter = spread * eased + (index % 5) * 2;
      const size =
        (burst.kind === "upgrade" ? 4.4 : burst.kind === "capture" ? 3.8 : 2.8) * (1 - progress);
      const targetX = burst.x + Math.cos(angle) * distanceFromCenter;
      const targetY = burst.y + Math.sin(angle) * distanceFromCenter;
      const x = burst.kind === "absorb" ? originX + (burst.x - originX) * eased : targetX;
      const y = burst.kind === "absorb" ? originY + (burst.y - originY) * eased : targetY;

      graphics.circle(x, y, Math.max(0.6, size)).fill({
        alpha: Math.max(0, 1 - progress),
        color: index % 4 === 0 ? 0xffffff : burst.color,
      });
    }

    layer.addChild(graphics);
  }
}

export function drawReachLines(layer: Container, state: GameState, selectedSourceId: null | StarId) {
  const lines = new Graphics();
  const selectedSource = selectedSourceId ? state.stars.find((star) => star.id === selectedSourceId) : null;

  for (let index = 0; index < state.stars.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < state.stars.length; otherIndex += 1) {
      const a = state.stars[index];
      const b = state.stars[otherIndex];

      if (!a || !b || (distance(a, b) > getJumpRange(a) && distance(a, b) > getJumpRange(b))) {
        continue;
      }

      const selectedReach =
        selectedSource &&
        (selectedSource.id === a.id || selectedSource.id === b.id) &&
        isDestinationReachable(state, selectedSource, selectedSource.id === a.id ? b : a);

      lines
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({
          alpha: selectedReach ? 0.32 : 0.1,
          color: selectedReach ? getPlayerColor(state, selectedSource.ownerId ?? HUMAN_PLAYER_ID) : 0x9db8d8,
          width: selectedReach ? 2 : 1,
        });
    }
  }

  layer.addChild(lines);
}

export function drawStars(
  layer: Container,
  state: GameState,
  selection: StarSelection,
  ownerTransitions: Map<StarId, OwnerTransition>,
) {
  const now = performance.now();

  for (const star of state.stars) {
    const color = getAnimatedStarColor(state, star, ownerTransitions, now);
    const radius = star.ownerId === HUMAN_PLAYER_ID ? 13 : 11;
    const selected = star.id === selection.selectedSourceId || star.id === selection.selectedDestinationId;
    const hovered = star.id === selection.hoveredStarId;
    const starGraphic = new Graphics();

    starGraphic
      .circle(star.x, star.y, radius + 10)
      .fill({ alpha: hovered ? 0.18 : 0.09, color })
      .circle(star.x, star.y, radius)
      .fill(color)
      .circle(star.x - radius * 0.34, star.y - radius * 0.36, radius * 0.35)
      .fill({ alpha: 0.7, color: 0xffffff });

    if (selected) {
      starGraphic.circle(star.x, star.y, radius + 16).stroke({ alpha: 0.95, color: 0xffffff, width: 2 });
    }

    if (star.upgrades.turret > 0) {
      starGraphic.circle(star.x, star.y, radius + 5 + star.upgrades.turret * 2).stroke({ alpha: 0.7, color, width: 2 });
    }

    layer.addChild(starGraphic);

    const label = new Text({
      resolution: MAP_TEXT_RESOLUTION,
      style: {
        fill: 0xe8f1ff,
        fontFamily: "Inter, system-ui",
        fontSize: 13,
        fontWeight: "600",
      },
      text: `${star.name} ${formatForces(star.forces)}`,
    });
    label.anchor.set(0.5, 0);
    label.position.set(star.x, star.y + radius + 12);
    layer.addChild(label);
  }
}

function drawBattleGroup(
  layer: Container,
  state: GameState,
  destination: Star,
  group: BattleGroup,
  index: number,
  groupCount: number,
) {
  const position = getBattleStationPosition(state, destination, group, index, groupCount);
  const origin = state.stars.find((star) => star.id === group.originStarId);
  const direction = origin ? getUnitVector(origin, destination) : { x: -1, y: 0 };
  const x = position.x;
  const y = position.y;
  const color = getPlayerColor(state, group.playerId);
  const attacker = new Graphics();

  attacker
    .circle(x, y, 10)
    .fill(color)
    .circle(x, y, 20)
    .stroke({ alpha: 0.5, color, width: 2 })
    .moveTo(x + direction.x * 12, y + direction.y * 12)
    .lineTo(destination.x - direction.x * 14, destination.y - direction.y * 14)
    .stroke({ alpha: 0.35, color, width: 2 });
  layer.addChild(attacker);

  drawBattleSparks(layer, { x, y }, destination, color, index);

  const label = new Text({
    resolution: MAP_TEXT_RESOLUTION,
    style: { fill: 0xf6d8df, fontFamily: "Inter, system-ui", fontSize: 12, fontWeight: "700" },
    text: formatForces(group.forces),
  });
  label.anchor.set(0.5);
  label.position.set(x, y - 25);
  layer.addChild(label);
}

function drawBattleSparks(
  layer: Container,
  source: { x: number; y: number },
  destination: Star,
  color: number,
  seed: number,
) {
  const sparks = new Graphics();
  const now = performance.now() * 0.006;
  const direction = getUnitVector(source, destination);
  const perpendicular = { x: -direction.y, y: direction.x };

  for (let index = 0; index < 8; index += 1) {
    const wave = (now * 12 + index * 0.18 + seed * 0.27) % 1;
    const jitter = Math.sin(now + index * 1.9) * 5;
    const alpha = 0.25 + ((index + seed) % 3) * 0.18;
    const x = source.x + (destination.x - source.x) * wave + perpendicular.x * jitter;
    const y = source.y + (destination.y - source.y) * wave + perpendicular.y * jitter;

    sparks.circle(x, y, 1.7 + (index % 3)).fill({ alpha, color });
  }

  layer.addChild(sparks);
}
