import type { BuildTask, GameState, Star } from "../../game/types";
import type { CommandMode } from "./types";

import { DollarSign, Factory, Radar, Rocket, Shield } from "lucide-react";

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
  canBuildFromSource: boolean;
  canBuildLaneToTarget: boolean | null;
  canSendToTarget: boolean;
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
  sourceUnderSiege: boolean;
  state: GameState;
}

export function GameCommandPanel({
  activeFactoryBuild,
  activeLaneBuild,
  activeTarget,
  activeTurretBuild,
  canBuildFromSource,
  canBuildLaneToTarget,
  canSendToTarget,
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
  sourceUnderSiege,
  state,
}: GameCommandPanelProps) {
  return (
    <aside className="command-panel">
      <section className="selected-star-section">
        {selectedSource ? (
          <StarReadout star={selectedSource} />
        ) : (
          <p className="muted">
            Select a star to inspect it. Select one of your cyan stars to command it.
          </p>
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
            disabled={selectedSource.ownerId !== HUMAN_PLAYER_ID || sourceUnderSiege || sendForces <= 0}
            onClick={() => onCommandModeChange(commandMode === "send" ? "inspect" : "send")}
            type="button"
          >
            <span className="action-label">
              <Rocket size={16} />
              Send
            </span>
            <span className="action-unit">{sendForces}</span>
          </button>
          <button
            disabled={
              !canBuildFromSource ||
              selectedSource.forces < factoryCost(selectedSource) ||
              activeFactoryBuild !== null
            }
            onClick={() => onUpgradeFactory(selectedSource.id)}
            style={buildProgressStyle(activeFactoryBuild, state.elapsedSeconds)}
            type="button"
          >
            <span className="action-label">
              <Factory size={16} />
              Factory
            </span>
            <span className="action-unit">
              {activeFactoryBuild ? (
                `${buildProgress(activeFactoryBuild, state.elapsedSeconds)}%`
              ) : (
                <>
                  <DollarSign size={14} />
                  {factoryCost(selectedSource)}
                </>
              )}
            </span>
          </button>
          <button
            disabled={
              !canBuildFromSource ||
              selectedSource.forces < turretCost(selectedSource) ||
              activeTurretBuild !== null
            }
            onClick={() => onUpgradeTurret(selectedSource.id)}
            style={buildProgressStyle(activeTurretBuild, state.elapsedSeconds)}
            type="button"
          >
            <span className="action-label">
              <Shield size={16} />
              Turret
            </span>
            <span className="action-unit">
              {activeTurretBuild ? (
                `${buildProgress(activeTurretBuild, state.elapsedSeconds)}%`
              ) : (
                <>
                  <DollarSign size={14} />
                  {turretCost(selectedSource)}
                </>
              )}
            </span>
          </button>
          <button
            className={commandMode === "lane" ? "active-command" : ""}
            disabled={!canBuildFromSource || activeLaneBuild !== null}
            onClick={onUpgradeLaneMode}
            style={buildProgressStyle(activeLaneBuild, state.elapsedSeconds)}
            type="button"
          >
            <span className="action-label">
              <Radar size={16} />
              Lane
            </span>
            <span className="action-unit">
              {activeLaneBuild ? (
                `${buildProgress(activeLaneBuild, state.elapsedSeconds)}%`
              ) : laneCost && commandMode === "lane" ? (
                <>
                  <DollarSign size={14} />
                  {laneCost}
                </>
              ) : (
                "-"
              )}
            </span>
          </button>
        </section>
      ) : null}

      {commandMode !== "inspect" ? (
        <section className="mode-hint">
          {sourceUnderSiege
            ? "Star under siege. It can receive reinforcements, but it cannot send fleets or start builds."
            : commandMode === "send" && activeTarget
            ? reachable
              ? canSendToTarget
                ? `Click to dispatch ${sendForces} forces.`
                : "This star cannot send fleets right now."
              : "No lane from the selected star."
            : commandMode === "lane" && laneTarget && laneCost
              ? canBuildLaneToTarget
                ? `Lane cost ${laneCost}. Click to start construction.`
                : `Lane cost ${laneCost}. Target is out of range, already linked, or underfunded.`
              : "Empty click or right-click cancels."}
        </section>
      ) : null}
    </aside>
  );
}
