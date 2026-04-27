import type { AiCommand } from "../ai/aiController";
import type { GameState, StarId } from "../types";

import { useCallback, useEffect, useRef, useState } from "react";

import { HUMAN_PLAYER_ID } from "../constants";
import {
  dispatchFleet,
  startFactoryBuild,
  startHyperspaceLaneBuild,
  startTurretBuild,
} from "../engine/actions";
import { advanceGame } from "../engine/simulation";
import { loadGame, saveGame } from "../persistence/storage";

const AI_INTERVAL_SECONDS = 1.6;
const TICK_MILLISECONDS = 100;

export function useGameSession(gameId: string | undefined) {
  const [state, setState] = useState<GameState | null>(() => (gameId ? loadGame(gameId) : null));
  const aiPendingRef = useRef(false);
  const aiWorkerRef = useRef<null | Worker>(null);
  const nextAiAtRef = useRef(AI_INTERVAL_SECONDS);
  const saveAtRef = useRef(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((current) => {
        if (!current || current.phase !== "playing") {
          return current;
        }

        const next = advanceGame(current, TICK_MILLISECONDS / 1000);

        if (next.phase !== "playing") {
          aiPendingRef.current = false;
          saveGame(next);
          return next;
        }

        if (next.elapsedSeconds >= nextAiAtRef.current && !aiPendingRef.current && aiWorkerRef.current) {
          aiPendingRef.current = true;
          nextAiAtRef.current = next.elapsedSeconds + AI_INTERVAL_SECONDS;
          aiWorkerRef.current?.postMessage(next);
        }

        if (next.elapsedSeconds >= saveAtRef.current) {
          saveGame(next);
          saveAtRef.current = next.elapsedSeconds + 1;
        }

        return next;
      });
    }, TICK_MILLISECONDS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("../ai/ai.worker.ts", import.meta.url), { type: "module" });
    aiWorkerRef.current = worker;

    worker.onmessage = (event: MessageEvent<AiCommand[]>) => {
      aiPendingRef.current = false;
      setState((current) => (current?.phase === "playing" ? applyAiCommands(current, event.data) : current));
    };

    worker.onerror = () => {
      aiPendingRef.current = false;
    };

    return () => {
      worker.terminate();
      aiWorkerRef.current = null;
    };
  }, []);

  const sendFleet = useCallback((sourceId: StarId, destinationId: StarId, forces: number) => {
    setState((current) =>
      current ? dispatchFleet(current, sourceId, destinationId, forces, HUMAN_PLAYER_ID) : current,
    );
  }, []);

  const upgradeFactory = useCallback((starId: StarId) => {
    setState((current) => (current ? startFactoryBuild(current, starId, HUMAN_PLAYER_ID) : current));
  }, []);

  const upgradeLane = useCallback((sourceId: StarId, destinationId: StarId) => {
    setState((current) =>
      current
        ? startHyperspaceLaneBuild(current, sourceId, destinationId, HUMAN_PLAYER_ID)
        : current,
    );
  }, []);

  const upgradeTurret = useCallback((starId: StarId) => {
    setState((current) => (current ? startTurretBuild(current, starId, HUMAN_PLAYER_ID) : current));
  }, []);

  return {
    sendFleet,
    state,
    upgradeFactory,
    upgradeLane,
    upgradeTurret,
  };
}

function applyAiCommands(state: GameState, commands: AiCommand[]) {
  return commands.reduce((next, command) => {
    if (next.phase !== "playing") {
      return next;
    }

    if (command.type === "dispatch") {
      return dispatchFleet(
        next,
        command.sourceStarId,
        command.targetStarId,
        command.forces,
        command.playerId,
      );
    }

    if (command.type === "factory") {
      return startFactoryBuild(next, command.starId, command.playerId);
    }

    if (command.type === "lane" && command.targetStarId) {
      return startHyperspaceLaneBuild(next, command.starId, command.targetStarId, command.playerId);
    }

    return startTurretBuild(next, command.starId, command.playerId);
  }, state);
}
