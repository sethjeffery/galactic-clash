import type { GameState } from "../types";

const INDEX_KEY = "galactic-clash:index";
const STORAGE_PREFIX = "galactic-clash:game:";

export function deleteGame(gameId: string) {
  localStorage.removeItem(`${STORAGE_PREFIX}${gameId}`);
  writeIndex(loadGameIndex().filter((id) => id !== gameId));
}

export function loadGame(gameId: string) {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${gameId}`);

  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as GameState;
}

export function loadGameIndex() {
  const raw = localStorage.getItem(INDEX_KEY);

  if (!raw) {
    return [];
  }

  return JSON.parse(raw) as string[];
}

export function saveGame(state: GameState) {
  localStorage.setItem(`${STORAGE_PREFIX}${state.id}`, JSON.stringify(state));

  const index = loadGameIndex();

  if (!index.includes(state.id)) {
    writeIndex([state.id, ...index].slice(0, 12));
  }
}

function writeIndex(ids: string[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}
