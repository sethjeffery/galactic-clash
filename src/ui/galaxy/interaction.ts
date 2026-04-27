import type { GameState } from "../../game/types";
import type { ActivePointer, Camera, PinchState } from "./types";

import { distance } from "../../game/math";
import { STAR_HIT_RADIUS } from "./constants";

export function findStarAtEvent(
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

export function getPinchState(pointers: Map<number, ActivePointer>): PinchState {
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

export function isTrackpadPanEvent(event: WheelEvent) {
  return !event.ctrlKey && event.deltaMode === WheelEvent.DOM_DELTA_PIXEL;
}
