import type { GameState, Star, StarId } from "../game/types";
import type {
  ActivePointer,
  BattleGroupSnapshot,
  Camera,
  DragState,
  OwnerTransition,
  ParticleBurst,
  PinchState,
} from "./galaxy/types";

import { Application, Container } from "pixi.js";
import { useCallback, useEffect, useRef } from "react";

import {
  queueBattleBursts,
  queueOwnerTransitions,
  queueUpgradeBursts,
} from "./galaxy/effects";
import { hasActiveOwnerTransitions } from "./galaxy/geometry";
import { findStarAtEvent, getPinchState, isTrackpadPanEvent } from "./galaxy/interaction";
import {
  drawBattles,
  drawCommandPulse,
  drawFleets,
  drawHyperspaceLanes,
  drawParticleBursts,
  drawReachLines,
  drawStars,
} from "./galaxy/renderers";

import "./GalaxyViewport.css";

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
  const activePointersRef = useRef(new Map<number, ActivePointer>());
  const cameraRef = useRef<Camera>({ scale: 0.7, x: 120, y: 90 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<DragState | null>(null);
  const dynamicLayerRef = useRef<Container | null>(null);
  const galaxyRootRef = useRef<Container | null>(null);
  const particleBurstsRef = useRef<ParticleBurst[]>([]);
  const pinchStateRef = useRef<PinchState | null>(null);
  const previousBattleGroupsRef = useRef(new Map<string, BattleGroupSnapshot>());
  const previousStarOwnersRef = useRef(new Map<StarId, null | string>());
  const previousUpgradeLevelsRef = useRef(new Map<StarId, string>());
  const starOwnerTransitionsRef = useRef(new Map<StarId, OwnerTransition>());
  const stateReceivedAtRef = useRef(0);
  const staticLayerRef = useRef<Container | null>(null);

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
  }, [drawDynamicGalaxy, hoveredStarId, selectedDestinationId, selectedSourceId, state]);

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
        galaxyRootRef.current = new Container();
        staticLayerRef.current = new Container();
        dynamicLayerRef.current = new Container();
        galaxyRootRef.current.addChild(staticLayerRef.current, dynamicLayerRef.current);
        app.stage.addChild(galaxyRootRef.current);
      });

    return () => {
      shouldDestroy = true;
      destroyApp();
      dynamicLayerRef.current = null;
      galaxyRootRef.current = null;
      staticLayerRef.current = null;
    };
  }, []);

  const updateCameraTransform = useCallback(() => {
    const root = galaxyRootRef.current;

    if (!root) {
      return;
    }

    root.position.set(cameraRef.current.x, cameraRef.current.y);
    root.scale.set(cameraRef.current.scale);
  }, []);

  const endPinchGesture = useCallback(() => {
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
  }, []);

  const updatePinchCamera = useCallback(
    (hostElement: HTMLDivElement) => {
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
    },
    [updateCameraTransform],
  );

  const zoomCameraAtWheelEvent = useCallback(
    (hostElement: HTMLDivElement, event: WheelEvent) => {
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
    },
    [updateCameraTransform],
  );

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
        updatePinchCamera(hostElement);
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
        endPinchGesture();
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

      zoomCameraAtWheelEvent(hostElement, event);
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
  }, [
    endPinchGesture,
    onCancelInteraction,
    onHoverStar,
    onStarClick,
    onStarRightClick,
    state,
    updateCameraTransform,
    updatePinchCamera,
    zoomCameraAtWheelEvent,
  ]);

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
}
