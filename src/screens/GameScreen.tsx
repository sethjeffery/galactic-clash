import type { BuildTask, BuildTaskType, Star, StarId } from "../game/types";
import type { CSSProperties } from "react";

import { ArrowLeft, Factory, MousePointer2, Radar, Shield, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { HUMAN_PLAYER_ID } from "../game/constants";
import {
  factoryCost,
  getGrowthPerSecond,
  laneBuildCost,
  turretCost,
} from "../game/engine/economy";
import { getStar, isDestinationReachable, isLaneBuildReachable } from "../game/engine/selectors";
import { useGameSession } from "../game/hooks/useGameSession";
import { formatForces } from "../game/math";
import { GalaxyViewport } from "../ui/GalaxyViewport";

type CommandMode = "inspect" | "lane" | "send";

export function GameScreen() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { sendFleet, state, upgradeFactory, upgradeLane, upgradeTurret } = useGameSession(gameId);
  const [hoveredStarId, setHoveredStarId] = useState<StarId | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<StarId | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<StarId | null>(null);
  const [sendPercent, setSendPercent] = useState(100);
  const [commandMode, setCommandMode] = useState<CommandMode>("inspect");

  useEffect(() => {
    if (state?.phase === "complete") {
      void navigate(`/results/${state.id}`);
    }
  }, [navigate, state]);

  const selectedSource = useMemo(
    () => (state && selectedSourceId ? getStar(state, selectedSourceId) : null),
    [selectedSourceId, state],
  );
  const selectedDestination = useMemo(
    () => (state && selectedDestinationId ? getStar(state, selectedDestinationId) : null),
    [selectedDestinationId, state],
  );
  const hoveredStar = useMemo(
    () => (state && hoveredStarId ? getStar(state, hoveredStarId) : null),
    [hoveredStarId, state],
  );

  if (!gameId) {
    return <Navigate replace to="/" />;
  }

  if (!state) {
    return (
      <main className="screen empty-state">
        <h1>Game not found</h1>
        <Link className="primary-action" to="/new">
          New Game
        </Link>
      </main>
    );
  }

  const gameState = state;

  function handleStarClick(star: Star) {
    if (!selectedSource || commandMode === "inspect") {
      setSelectedSourceId(star.id);
      setSelectedDestinationId(null);
      setCommandMode("inspect");
      return;
    }

    if (star.id === selectedSource.id) {
      setCommandMode("inspect");
      return;
    }

    setSelectedDestinationId(star.id);

    if (commandMode === "send") {
      if (isDestinationReachable(gameState, selectedSource, star) && sendForces > 0) {
        sendFleet(selectedSource.id, star.id, sendForces);
        setCommandMode("inspect");
      }
      return;
    }

    if (commandMode === "lane") {
      const cost = laneBuildCost(selectedSource, star);

      if (
        selectedSource.forces >= cost &&
        isLaneBuildReachable(selectedSource, star) &&
        !gameState.hyperspaceLanes.some(
          (lane) =>
            (lane.aStarId === selectedSource.id && lane.bStarId === star.id) ||
            (lane.aStarId === star.id && lane.bStarId === selectedSource.id),
        )
      ) {
        upgradeLane(selectedSource.id, star.id);
        setCommandMode("inspect");
      }
    }
  }

  function handleStarRightClick(star: Star) {
    if (
      selectedSource &&
      selectedSource.ownerId === HUMAN_PLAYER_ID &&
      star.id !== selectedSource.id &&
      isDestinationReachable(gameState, selectedSource, star) &&
      sendForces > 0
    ) {
      sendFleet(selectedSource.id, star.id, sendForces);
      setSelectedDestinationId(star.id);
      setCommandMode("inspect");
      return;
    }

    if (star.ownerId === HUMAN_PLAYER_ID) {
      setSelectedSourceId(star.id);
      setSelectedDestinationId(null);
    }

    setCommandMode("inspect");
  }

  function clearCommandMode() {
    setCommandMode("inspect");
    setSelectedDestinationId(null);
  }

  const hoveredTarget = hoveredStarId ? getStar(gameState, hoveredStarId) : null;
  const activeTarget =
    commandMode === "inspect" ? selectedDestination : hoveredTarget ?? selectedDestination;
  const reachable =
    selectedSource && activeTarget
      ? isDestinationReachable(gameState, selectedSource, activeTarget)
      : false;
  const sendForces = selectedSource
    ? Math.max(0, Math.floor((selectedSource.forces - 1) * (sendPercent / 100)))
    : 0;
  const laneTarget = commandMode === "lane" ? hoveredTarget ?? selectedDestination : selectedDestination;
  const laneCost = selectedSource && laneTarget ? laneBuildCost(selectedSource, laneTarget) : null;
  const canBuildLaneToTarget =
    selectedSource &&
    laneTarget &&
    laneCost !== null &&
    selectedSource.forces >= laneCost &&
    isLaneBuildReachable(selectedSource, laneTarget) &&
    !state.hyperspaceLanes.some(
      (lane) =>
        (lane.aStarId === selectedSource.id && lane.bStarId === laneTarget.id) ||
        (lane.aStarId === laneTarget.id && lane.bStarId === selectedSource.id),
    );
  const activeFactoryBuild = selectedSource
    ? getActiveBuild(gameState.buildTasks, selectedSource.id, "factory")
    : null;
  const activeLaneBuild = selectedSource
    ? getActiveBuild(gameState.buildTasks, selectedSource.id, "hyperspace_lane")
    : null;
  const activeTurretBuild = selectedSource
    ? getActiveBuild(gameState.buildTasks, selectedSource.id, "turret")
    : null;

  return (
    <main className="game-shell">
      <header className="game-topbar">
        <Link className="icon-link" to="/">
          <ArrowLeft size={18} />
          Quit
        </Link>
        <div className="status-strip">
          <span>{Math.floor(state.elapsedSeconds / 60)}m elapsed</span>
          <span>{state.fleets.length} fleets</span>
          <span>{state.battles.length} battles</span>
        </div>
      </header>

      <GalaxyViewport
        hoveredStarId={hoveredStarId}
        interactionMode={commandMode}
        onCancelInteraction={clearCommandMode}
        onHoverStar={setHoveredStarId}
        onStarRightClick={handleStarRightClick}
        onStarClick={handleStarClick}
        selectedDestinationId={activeTarget?.id ?? null}
        selectedSourceId={selectedSourceId}
        state={state}
      />

      <aside className="command-panel">
        <section>
          <p className="eyebrow">Selected star</p>
          {selectedSource ? (
            <StarReadout star={selectedSource} />
          ) : (
            <p className="muted">Select a star to inspect it. Select one of your cyan stars to command it.</p>
          )}
        </section>

        {selectedSource ? (
          <section className="action-stack">
            <label htmlFor="send-percent">Dispatch {sendPercent}%</label>
            <input
              id="send-percent"
              max="100"
              min="5"
              onChange={(event) => setSendPercent(Number(event.target.value))}
              step="5"
              type="range"
              value={sendPercent}
            />
            <button
              className={commandMode === "send" ? "active-command" : ""}
              disabled={selectedSource.ownerId !== HUMAN_PLAYER_ID || sendForces <= 0}
              onClick={() => setCommandMode(commandMode === "send" ? "inspect" : "send")}
              type="button"
            >
              {commandMode === "send" ? <MousePointer2 size={16} /> : <Zap size={16} />}
              {commandMode === "send" ? "Choose target" : `Send Troops (${sendForces})`}
            </button>
            <button
              disabled={
                selectedSource.ownerId !== HUMAN_PLAYER_ID ||
                selectedSource.forces < factoryCost(selectedSource) ||
                activeFactoryBuild !== null
              }
              onClick={() => upgradeFactory(selectedSource.id)}
              style={buildProgressStyle(activeFactoryBuild, state.elapsedSeconds)}
              type="button"
            >
              <Factory size={16} />
              {activeFactoryBuild
                ? `Factory ${buildProgress(activeFactoryBuild, state.elapsedSeconds)}%`
                : `Factory (${factoryCost(selectedSource)})`}
            </button>
            <button
              disabled={
                selectedSource.ownerId !== HUMAN_PLAYER_ID ||
                selectedSource.forces < turretCost(selectedSource) ||
                activeTurretBuild !== null
              }
              onClick={() => upgradeTurret(selectedSource.id)}
              style={buildProgressStyle(activeTurretBuild, state.elapsedSeconds)}
              type="button"
            >
              <Shield size={16} />
              {activeTurretBuild
                ? `Turret ${buildProgress(activeTurretBuild, state.elapsedSeconds)}%`
                : `Turret (${turretCost(selectedSource)})`}
            </button>
            <button
              className={commandMode === "lane" ? "active-command" : ""}
              disabled={selectedSource.ownerId !== HUMAN_PLAYER_ID || activeLaneBuild !== null}
              onClick={() => setCommandMode(commandMode === "lane" ? "inspect" : "lane")}
              style={buildProgressStyle(activeLaneBuild, state.elapsedSeconds)}
              type="button"
            >
              <Radar size={16} />
              {activeLaneBuild
                ? `Build Lane ${buildProgress(activeLaneBuild, state.elapsedSeconds)}%`
                : `Build Lane${laneCost && commandMode === "lane" ? ` (${laneCost})` : ""}`}
            </button>
          </section>
        ) : null}

        <section>
          <p className="eyebrow">{commandMode === "inspect" ? "Target" : "Command target"}</p>
          {activeTarget ? (
            <StarReadout star={activeTarget} />
          ) : (
            <p className="muted">
              {commandMode === "send"
                ? "Click any linked star to send troops, including friendly stars."
                : commandMode === "lane"
                  ? "Click another star to start constructing a lane."
                  : "Use Send Troops or Build Lane to choose a target."}
            </p>
          )}
        </section>

        {commandMode !== "inspect" ? (
          <section className="mode-hint">
            {commandMode === "send" && activeTarget
              ? reachable
                ? `Click to dispatch ${sendForces} forces.`
                : "No lane from the selected star."
              : null}
            {commandMode === "lane" && laneTarget && laneCost
              ? canBuildLaneToTarget
                ? `Lane cost ${laneCost}. Click to start construction.`
                : `Lane cost ${laneCost}. Target is out of range, already linked, or underfunded.`
              : "Empty click or right-click cancels."}
          </section>
        ) : null}
      </aside>

      <footer className="hover-bar">
        {hoveredStar ? (
          <>
            <strong>{hoveredStar.name}</strong>
            <span>{formatForces(hoveredStar.forces)} stationed</span>
            <span>{hoveredStar.resourceEfficiency.toFixed(2)} efficiency</span>
          </>
        ) : (
          <span>Drag to pan. Scroll to zoom. Empty click or right-click cancels command mode.</span>
        )}
      </footer>
    </main>
  );
}

function buildProgress(task: BuildTask, elapsedSeconds: number) {
  return Math.round(getTaskProgress(task, elapsedSeconds) * 100);
}

function buildProgressStyle(task: BuildTask | null, elapsedSeconds: number) {
  if (!task) {
    return undefined;
  }

  return {
    "--progress": `${buildProgress(task, elapsedSeconds)}%`,
  } as CSSProperties;
}

function getActiveBuild(buildTasks: BuildTask[] | undefined, sourceStarId: StarId, type: BuildTaskType) {
  return (
    (buildTasks ?? []).find((task) => task.sourceStarId === sourceStarId && task.type === type) ?? null
  );
}

function getTaskProgress(task: BuildTask, elapsedSeconds: number) {
  const duration = task.completeAt - task.startedAt;

  if (duration <= 0) {
    return 1;
  }

  return Math.min(1, Math.max(0, (elapsedSeconds - task.startedAt) / duration));
}

function StarReadout({ star }: { star: Star }) {
  return (
    <div className="star-readout">
      <h2>{star.name}</h2>
      <dl>
        <div>
          <dt>Forces</dt>
          <dd>{formatForces(star.forces)}</dd>
        </div>
        <div>
          <dt>Growth</dt>
          <dd>{getGrowthPerSecond(star).toFixed(2)}/s</dd>
        </div>
        <div>
          <dt>Factory</dt>
          <dd>{star.upgrades.factory}</dd>
        </div>
        <div>
          <dt>Turret</dt>
          <dd>{star.upgrades.turret}</dd>
        </div>
      </dl>
    </div>
  );
}
