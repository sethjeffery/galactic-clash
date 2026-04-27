import type { BattleGroup, Fleet, GameState, Player, Star, StarId } from "../game/types";

import { Application, Container, Graphics, Text } from "pixi.js";
import { useCallback, useEffect, useRef } from "react";

import { HUMAN_PLAYER_ID } from "../game/constants";
import { getJumpRange, isDestinationReachable } from "../game/engine/selectors";
import { distance, formatForces } from "../game/math";

interface Camera {
  scale: number;
  x: number;
  y: number;
}

interface ActivePointer {
  x: number;
  y: number;
}

interface DragState {
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
}

interface ParticleBurst {
  color: number;
  duration: number;
  fromX?: number;
  fromY?: number;
  kind: "absorb" | "arrival" | "capture" | "death" | "upgrade";
  startedAt: number;
  x: number;
  y: number;
}

interface BattleGroupSnapshot {
  playerId: string;
  starId: StarId;
  x: number;
  y: number;
}

interface OwnerTransition {
  duration: number;
  fromColor: number;
  startedAt: number;
  toColor: number;
}

interface PinchState {
  lastCenterX: number;
  lastCenterY: number;
  lastDistance: number;
}

interface GalaxyViewportProps {
  hoveredStarId: null | StarId;
  interactionMode: "inspect" | "lane" | "send";
  onCancelInteraction: () => void;
  onHoverStar: (starId: null | StarId) => void;
  onStarRightClick: (star: Star) => void;
  onStarClick: (star: Star) => void;
  selectedDestinationId: null | StarId;
  selectedSourceId: null | StarId;
  state: GameState;
}

const NEUTRAL_COLOR = 0x8793a6;
const STAR_HIT_RADIUS = 28;

export function GalaxyViewport({
  hoveredStarId,
  interactionMode,
  onCancelInteraction,
  onHoverStar,
  onStarRightClick,
  onStarClick,
  selectedDestinationId,
  selectedSourceId,
  state,
}: GalaxyViewportProps) {
  const appRef = useRef<Application | null>(null);
  const activePointersRef = useRef(new Map<number, ActivePointer>());
  const cameraRef = useRef<Camera>({ scale: 0.7, x: 120, y: 90 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<DragState | null>(null);
  const dynamicLayerRef = useRef<Container | null>(null);
  const galaxyRootRef = useRef<Container | null>(null);
  const particleBurstsRef = useRef<ParticleBurst[]>([]);
  const previousBattleGroupsRef = useRef(new Map<string, BattleGroupSnapshot>());
  const previousStarOwnersRef = useRef(new Map<StarId, null | string>());
  const previousUpgradeLevelsRef = useRef(new Map<StarId, string>());
  const pinchStateRef = useRef<PinchState | null>(null);
  const staticLayerRef = useRef<Container | null>(null);
  const starOwnerTransitionsRef = useRef(new Map<StarId, OwnerTransition>());
  const stateReceivedAtRef = useRef(0);

  useEffect(() => {
    stateReceivedAtRef.current = performance.now();
    queueBattleBursts(state, previousBattleGroupsRef.current, particleBurstsRef.current);
    queueOwnerTransitions(
      state,
      previousStarOwnersRef.current,
      starOwnerTransitionsRef.current,
      particleBurstsRef.current,
    );
    queueUpgradeBursts(state, previousUpgradeLevelsRef.current, particleBurstsRef.current);
  }, [state]);

  const drawDynamicGalaxy = useCallback(() => {
    const dynamicLayer = dynamicLayerRef.current;

    if (!dynamicLayer) {
      return;
    }

    dynamicLayer.removeChildren();
    const visualElapsedSeconds =
      state.elapsedSeconds + (performance.now() - stateReceivedAtRef.current) / 1000;

    drawCommandPulse(dynamicLayer, state, {
      interactionMode,
      selectedDestinationId,
      selectedSourceId,
    });
    drawBattles(dynamicLayer, state);
    drawFleets(dynamicLayer, state, visualElapsedSeconds);
    drawParticleBursts(dynamicLayer, particleBurstsRef.current);
  }, [interactionMode, selectedDestinationId, selectedSourceId, state]);

  const drawGalaxy = useCallback(() => {
    const root = galaxyRootRef.current;
    const staticLayer = staticLayerRef.current;

    if (!root || !staticLayer) {
      return;
    }

    root.position.set(cameraRef.current.x, cameraRef.current.y);
    root.scale.set(cameraRef.current.scale);
    staticLayer.removeChildren();
    drawReachLines(staticLayer, state, selectedSourceId);
    drawHyperspaceLanes(staticLayer, state);
    drawStars(
      staticLayer,
      state,
      {
        hoveredStarId,
        selectedDestinationId,
        selectedSourceId,
      },
      starOwnerTransitionsRef.current,
    );
    drawDynamicGalaxy();
  }, [
    drawDynamicGalaxy,
    hoveredStarId,
    selectedDestinationId,
    selectedSourceId,
    state,
  ]);

  useEffect(() => {
    const host = containerRef.current;

    if (!host) {
      return;
    }

    let initialized = false;
    let shouldDestroy = false;
    let wasDestroyed = false;
    const app = new Application();

    function destroyApp() {
      if (!initialized || wasDestroyed) {
        return;
      }

      wasDestroyed = true;
      app.destroy(true, { children: true });
    }

    void app
      .init({
        antialias: true,
        backgroundAlpha: 0,
        preference: "webgl",
        resizeTo: host,
      })
      .then(() => {
        initialized = true;

        if (shouldDestroy) {
          destroyApp();
          return;
        }

        host.appendChild(app.canvas);
        appRef.current = app;
        galaxyRootRef.current = new Container();
        staticLayerRef.current = new Container();
        dynamicLayerRef.current = new Container();
        galaxyRootRef.current.addChild(staticLayerRef.current, dynamicLayerRef.current);
        app.stage.addChild(galaxyRootRef.current);
      });

    return () => {
      shouldDestroy = true;
      destroyApp();
      appRef.current = null;
      dynamicLayerRef.current = null;
      galaxyRootRef.current = null;
      staticLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = containerRef.current;

    if (!host) {
      return;
    }

    const hostElement = host;

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }

      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      hostElement.setPointerCapture(event.pointerId);

      if (activePointersRef.current.size >= 2) {
        draggingRef.current = null;
        pinchStateRef.current = getPinchState(activePointersRef.current);
        return;
      }

      draggingRef.current = {
        lastX: event.clientX,
        lastY: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
      };
    }

    function handlePointerMove(event: PointerEvent) {
      if (activePointersRef.current.has(event.pointerId)) {
        activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (activePointersRef.current.size >= 2) {
        const nextPinch = getPinchState(activePointersRef.current);
        const previousPinch = pinchStateRef.current ?? nextPinch;
        const rect = hostElement.getBoundingClientRect();
        const distanceRatio =
          previousPinch.lastDistance > 0 ? nextPinch.lastDistance / previousPinch.lastDistance : 1;
        const oldCamera = cameraRef.current;
        const nextScale = Math.min(1.65, Math.max(0.34, oldCamera.scale * distanceRatio));
        const worldX = (previousPinch.lastCenterX - rect.left - oldCamera.x) / oldCamera.scale;
        const worldY = (previousPinch.lastCenterY - rect.top - oldCamera.y) / oldCamera.scale;
        const centerDx = nextPinch.lastCenterX - previousPinch.lastCenterX;
        const centerDy = nextPinch.lastCenterY - previousPinch.lastCenterY;

        cameraRef.current = {
          scale: nextScale,
          x: previousPinch.lastCenterX - rect.left + centerDx - worldX * nextScale,
          y: previousPinch.lastCenterY - rect.top + centerDy - worldY * nextScale,
        };
        pinchStateRef.current = nextPinch;
        updateCameraTransform();
        return;
      }

      if (!draggingRef.current) {
        const star = findStarAtEvent(state, cameraRef.current, hostElement, event);
        onHoverStar(star?.id ?? null);
        return;
      }

      const dx = event.clientX - draggingRef.current.lastX;
      const dy = event.clientY - draggingRef.current.lastY;
      draggingRef.current = {
        ...draggingRef.current,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      cameraRef.current = {
        ...cameraRef.current,
        x: cameraRef.current.x + dx,
        y: cameraRef.current.y + dy,
      };
      updateCameraTransform();
    }

    function handlePointerUp(event: PointerEvent) {
      activePointersRef.current.delete(event.pointerId);

      if (activePointersRef.current.size >= 2) {
        pinchStateRef.current = getPinchState(activePointersRef.current);
        return;
      }

      if (pinchStateRef.current) {
        pinchStateRef.current = null;
        const remainingPointer = [...activePointersRef.current.values()][0];
        draggingRef.current = remainingPointer
          ? {
              lastX: remainingPointer.x,
              lastY: remainingPointer.y,
              startX: remainingPointer.x,
              startY: remainingPointer.y,
            }
          : null;
        return;
      }

      if (!draggingRef.current) {
        return;
      }

      const moved = Math.hypot(
        event.clientX - draggingRef.current.startX,
        event.clientY - draggingRef.current.startY,
      );
      draggingRef.current = null;

      if (moved < 3) {
        const star = findStarAtEvent(state, cameraRef.current, hostElement, event);

        if (star) {
          onStarClick(star);
        } else {
          onCancelInteraction();
        }
      }
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();

      if (isTrackpadPanEvent(event)) {
        cameraRef.current = {
          ...cameraRef.current,
          x: cameraRef.current.x - event.deltaX,
          y: cameraRef.current.y - event.deltaY,
        };
        updateCameraTransform();
        return;
      }

      const rect = hostElement.getBoundingClientRect();
      const oldCamera = cameraRef.current;
      const worldX = (event.clientX - rect.left - oldCamera.x) / oldCamera.scale;
      const worldY = (event.clientY - rect.top - oldCamera.y) / oldCamera.scale;
      const zoomStep = event.ctrlKey ? 0.025 : 0.1;
      const nextScale = Math.min(
        1.65,
        Math.max(0.34, oldCamera.scale * (event.deltaY > 0 ? 1 - zoomStep : 1 + zoomStep)),
      );

      cameraRef.current = {
        scale: nextScale,
        x: event.clientX - rect.left - worldX * nextScale,
        y: event.clientY - rect.top - worldY * nextScale,
      };
      updateCameraTransform();
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault();
      activePointersRef.current.clear();
      draggingRef.current = null;
      pinchStateRef.current = null;

      const star = findStarAtEvent(state, cameraRef.current, hostElement, event);

      if (star) {
        onStarRightClick(star);
        return;
      }

      onCancelInteraction();
    }

    hostElement.addEventListener("contextmenu", handleContextMenu);
    hostElement.addEventListener("pointerdown", handlePointerDown);
    hostElement.addEventListener("pointermove", handlePointerMove);
    hostElement.addEventListener("pointerup", handlePointerUp);
    hostElement.addEventListener("pointercancel", handlePointerUp);
    hostElement.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      hostElement.removeEventListener("contextmenu", handleContextMenu);
      hostElement.removeEventListener("pointerdown", handlePointerDown);
      hostElement.removeEventListener("pointermove", handlePointerMove);
      hostElement.removeEventListener("pointerup", handlePointerUp);
      hostElement.removeEventListener("pointercancel", handlePointerUp);
      hostElement.removeEventListener("wheel", handleWheel);
    };
  }, [drawGalaxy, onCancelInteraction, onHoverStar, onStarClick, onStarRightClick, state]);

  useEffect(() => {
    drawGalaxy();
  }, [drawGalaxy]);

  useEffect(() => {
    let frame = 0;

    function animate() {
      if (hasActiveOwnerTransitions(starOwnerTransitionsRef.current)) {
        drawGalaxy();
      } else {
        drawDynamicGalaxy();
      }

      frame = window.requestAnimationFrame(animate);
    }

    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [drawDynamicGalaxy, drawGalaxy]);

  return <div className="galaxy-viewport" ref={containerRef} />;

  function updateCameraTransform() {
    const root = galaxyRootRef.current;

    if (!root) {
      return;
    }

    root.position.set(cameraRef.current.x, cameraRef.current.y);
    root.scale.set(cameraRef.current.scale);
  }
}

function drawFleets(layer: Container, state: GameState, elapsedSeconds: number) {
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

    fleetGraphic
      .circle(x, y, 10)
      .fill(color)
      .circle(x, y, 20)
      .stroke({ alpha: 0.35, color, width: 2 });
    layer.addChild(fleetGraphic);

    const text = new Text({
      style: { fill: 0xdde8f8, fontFamily: "Inter, system-ui", fontSize: 12 },
      text: formatForces(fleet.forces),
    });
    text.position.set(x + 12, y - 8);
    layer.addChild(text);
  }
}

function drawBattles(layer: Container, state: GameState) {
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

function drawHyperspaceLanes(layer: Container, state: GameState) {
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

function drawReachLines(layer: Container, state: GameState, selectedSourceId: null | StarId) {
  const lines = new Graphics();
  const selectedSource = selectedSourceId
    ? state.stars.find((star) => star.id === selectedSourceId)
    : null;

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

function drawCommandPulse(
  layer: Container,
  state: GameState,
  selection: {
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

  const pulse = new Graphics();
  const travelDistance = distance(source, destination);
  const unit = getUnitVector(source, destination);
  const phase = (performance.now() / 42) % 28;
  const color = selection.interactionMode === "send" ? getPlayerColor(state, source.ownerId ?? HUMAN_PLAYER_ID) : 0xffffff;

  pulse
    .moveTo(source.x, source.y)
    .lineTo(destination.x, destination.y)
    .stroke({ alpha: 0.4, color, width: 3 });

  for (let offset = phase; offset < travelDistance; offset += 28) {
    const x = source.x + unit.x * offset;
    const y = source.y + unit.y * offset;

    pulse.circle(x, y, 3.2).fill({ alpha: 0.86, color });
  }

  layer.addChild(pulse);
}

function drawStars(
  layer: Container,
  state: GameState,
  selection: {
    hoveredStarId: null | StarId;
    selectedDestinationId: null | StarId;
    selectedSourceId: null | StarId;
  },
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
      starGraphic
        .circle(star.x, star.y, radius + 5 + star.upgrades.turret * 2)
        .stroke({ alpha: 0.7, color, width: 2 });
    }

    layer.addChild(starGraphic);

    const label = new Text({
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

function drawParticleBursts(layer: Container, bursts: ParticleBurst[]) {
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
      const x =
        burst.kind === "absorb" ? originX + (burst.x - originX) * eased : targetX;
      const y =
        burst.kind === "absorb" ? originY + (burst.y - originY) * eased : targetY;

      graphics.circle(x, y, Math.max(0.6, size)).fill({
        alpha: Math.max(0, 1 - progress),
        color: index % 4 === 0 ? 0xffffff : burst.color,
      });
    }

    layer.addChild(graphics);
  }
}

function queueUpgradeBursts(
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

function queueBattleBursts(
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
      const position = getBattleStationPosition(
        state,
        destination,
        group,
        index,
        battle.attackers.length,
      );
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

function queueOwnerTransitions(
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

function findStarAtEvent(
  state: GameState,
  camera: Camera,
  host: HTMLDivElement,
  event: Pick<PointerEvent, "clientX" | "clientY">,
) {
  const rect = host.getBoundingClientRect();
  const x = (event.clientX - rect.left - camera.x) / camera.scale;
  const y = (event.clientY - rect.top - camera.y) / camera.scale;

  return (
    state.stars
      .map((star) => ({ distance: distance(star, { x, y }), star }))
      .filter((entry) => entry.distance <= STAR_HIT_RADIUS)
      .sort((a, b) => a.distance - b.distance)[0]?.star ?? null
  );
}

function isTrackpadPanEvent(event: WheelEvent) {
  return !event.ctrlKey && event.deltaMode === WheelEvent.DOM_DELTA_PIXEL;
}

function getFleetProgress(elapsedSeconds: number, fleet: Fleet) {
  const duration = fleet.arrivalAt - fleet.departedAt;

  if (duration <= 0) {
    return 1;
  }

  return Math.min(1, Math.max(0, (elapsedSeconds - fleet.departedAt) / duration));
}

function getFleetPosition(origin: Star, destination: Star, progress: number) {
  const visibleProgress = getFleetVisibleProgress(origin, destination, progress);

  return {
    x: origin.x + (destination.x - origin.x) * visibleProgress,
    y: origin.y + (destination.y - origin.y) * visibleProgress,
  };
}

function getFleetVisibleProgress(origin: Star, destination: Star, progress: number) {
  return Math.min(progress, getFleetStopProgress(origin, destination));
}

function getFleetStopProgress(origin: Star, destination: Star) {
  const travelDistance = distance(origin, destination);
  const stopDistance = Math.min(42, travelDistance * 0.45);

  return travelDistance <= 0 ? 1 : (travelDistance - stopDistance) / travelDistance;
}

function getBattleStationPosition(
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

function getUnitVector(source: { x: number; y: number }, destination: { x: number; y: number }) {
  const length = Math.max(1, distance(source, destination));

  return {
    x: (destination.x - source.x) / length,
    y: (destination.y - source.y) / length,
  };
}

function getPinchState(pointers: Map<number, ActivePointer>): PinchState {
  const [first, second] = [...pointers.values()];

  if (!first || !second) {
    return {
      lastCenterX: first?.x ?? 0,
      lastCenterY: first?.y ?? 0,
      lastDistance: 0,
    };
  }

  return {
    lastCenterX: (first.x + second.x) / 2,
    lastCenterY: (first.y + second.y) / 2,
    lastDistance: Math.hypot(first.x - second.x, first.y - second.y),
  };
}

function getAnimatedStarColor(
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

function getPlayerColor(state: GameState, playerId: string) {
  return state.players.find((player: Player) => player.id === playerId)?.color ?? NEUTRAL_COLOR;
}

function hasActiveOwnerTransitions(transitions: Map<StarId, OwnerTransition>) {
  const now = performance.now();

  return [...transitions.values()].some((transition) => now - transition.startedAt < transition.duration);
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
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
