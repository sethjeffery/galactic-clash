import type { Star, StarId } from "../game/types";
import type { CommandMode } from "./game/types";

import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { HUMAN_PLAYER_ID } from "../game/constants";
import { laneBuildCost } from "../game/engine/economy";
import { getStar, isDestinationReachable, isLaneBuildReachable } from "../game/engine/selectors";
import { useGameSession } from "../game/hooks/useGameSession";
import { formatForces } from "../game/math";
import { GalaxyViewport } from "../ui/GalaxyViewport";
import { getActiveBuild } from "./game/buildProgress";
import { GameCommandPanel } from "./game/GameCommandPanel";

import "./GameScreen.css";

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

      <GameCommandPanel
        activeFactoryBuild={activeFactoryBuild}
        activeLaneBuild={activeLaneBuild}
        activeTarget={activeTarget}
        activeTurretBuild={activeTurretBuild}
        canBuildLaneToTarget={canBuildLaneToTarget}
        commandMode={commandMode}
        laneCost={laneCost}
        laneTarget={laneTarget}
        onCommandModeChange={setCommandMode}
        onSendPercentChange={setSendPercent}
        onUpgradeFactory={upgradeFactory}
        onUpgradeLaneMode={() => setCommandMode(commandMode === "lane" ? "inspect" : "lane")}
        onUpgradeTurret={upgradeTurret}
        reachable={reachable}
        selectedSource={selectedSource}
        sendForces={sendForces}
        sendPercent={sendPercent}
        state={state}
      />

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
