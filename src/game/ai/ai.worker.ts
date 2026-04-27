import type { GameState } from "../types";

import { planAiTurn } from "./aiController";

self.onmessage = (event: MessageEvent<GameState>) => {
  self.postMessage(planAiTurn(event.data));
};
