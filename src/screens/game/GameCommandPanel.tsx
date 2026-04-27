import type { BuildTask, GameState, Star } from "../../game/types";
import type { CommandMode } from "./types";

import { Factory, MousePointer2, Radar, Shield, Zap } from "lucide-react";

import { HUMAN_PLAYER_ID } from "../../game/constants";
import { factoryCost, turretCost } from "../../game/engine/economy";
import { buildProgress, buildProgressStyle } from "./buildProgress";
import { StarReadout } from "./StarReadout";

import "./GameCommandPanel.css";

interface GameCommandPanelProps {
  activeFactoryBuild: BuildTask | null;
  activeLaneBuild: BuildTask | null;
  activeTarget: Star | null;
  activeTurretBuild: BuildTask | null;
  canBuildLaneToTarget: boolean | null;
  commandMode: CommandMode;
  laneCost: null | number;
  laneTarget: Star | null;
  onCommandModeChange: (mode: CommandMode) => void;
  onSendPercentChange: (value: number) => void;
  onUpgradeFactory: (starId: string) => void;
  onUpgradeLaneMode: () => void;
  onUpgradeTurret: (starId: string) => void;
  reachable: boolean | null;
  selectedSource: Star | null;
  sendForces: number;
  sendPercent: number;
  state: GameState;
}

export function GameCommandPanel({
  activeFactoryBuild,
  activeLaneBuild,
  activeTarget,
  activeTurretBuild,
  canBuildLaneToTarget,
  commandMode,
  laneCost,
  laneTarget,
  onCommandModeChange,
  onSendPercentChange,
  onUpgradeFactory,
  onUpgradeLaneMode,
  onUpgradeTurret,
  reachable,
  selectedSource,
  sendForces,
  sendPercent,
  state,
}: GameCommandPanelProps) {
  return (
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
            onChange={(event) => onSendPercentChange(Number(event.target.value))}
            step="5"
            type="range"
            value={sendPercent}
          />
          <button
            className={commandMode === "send" ? "active-command" : ""}
            disabled={selectedSource.ownerId !== HUMAN_PLAYER_ID || sendForces <= 0}
            onClick={() => onCommandModeChange(commandMode === "send" ? "inspect" : "send")}
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
            onClick={() => onUpgradeFactory(selectedSource.id)}
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
            onClick={() => onUpgradeTurret(selectedSource.id)}
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
            onClick={onUpgradeLaneMode}
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
  );
}
