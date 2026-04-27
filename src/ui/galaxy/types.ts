import type { StarId } from "../../game/types";

export interface ActivePointer {
  x: number;
  y: number;
}

export interface BattleGroupSnapshot {
  playerId: string;
  starId: StarId;
  x: number;
  y: number;
}

export interface Camera {
  scale: number;
  x: number;
  y: number;
}

export interface DragState {
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
}

export interface OwnerTransition {
  duration: number;
  fromColor: number;
  startedAt: number;
  toColor: number;
}

export interface ParticleBurst {
  color: number;
  duration: number;
  fromX?: number;
  fromY?: number;
  kind: "absorb" | "arrival" | "capture" | "death" | "upgrade";
  startedAt: number;
  x: number;
  y: number;
}

export interface PinchState {
  lastCenterX: number;
  lastCenterY: number;
  lastDistance: number;
}

export interface StarSelection {
  hoveredStarId: null | StarId;
  selectedDestinationId: null | StarId;
  selectedSourceId: null | StarId;
}
