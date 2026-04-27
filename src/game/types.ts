export type Difficulty = "cadet" | "admiral" | "warlord";
export type GamePhase = "playing" | "complete";
export type MapSize = "compact" | "standard" | "expansive";
export type OpponentCount = 1 | 2 | 3;
export type PlayerId = string;
export type StarId = string;
export type WinConditionType = "capture_all_enemy_stars";
export type BuildTaskType = "factory" | "hyperspace_lane" | "turret";

export interface Battle {
  attackers: BattleGroup[];
  defenderForces: number;
  defenderPlayerId: null | PlayerId;
  starId: StarId;
}

export interface BattleGroup {
  forces: number;
  id: string;
  originStarId: StarId;
  playerId: PlayerId;
}

export interface BuildTask {
  completeAt: number;
  cost: number;
  id: string;
  playerId: PlayerId;
  sourceStarId: StarId;
  startedAt: number;
  targetStarId?: StarId;
  type: BuildTaskType;
}

export interface Fleet {
  arrivalAt: number;
  destinationStarId: StarId;
  departedAt: number;
  forces: number;
  id: string;
  ownerId: PlayerId;
  originStarId: StarId;
}

export interface GameConfig {
  difficulty: Difficulty;
  mapSize: MapSize;
  opponentCount: OpponentCount;
  winCondition: WinConditionType;
}

export interface GameState {
  aiUnlockedAt: null | number;
  battles: Battle[];
  buildTasks: BuildTask[];
  config: GameConfig;
  createdAt: string;
  elapsedSeconds: number;
  fleets: Fleet[];
  id: string;
  hyperspaceLanes: HyperspaceLane[];
  map: GalaxyMap;
  phase: GamePhase;
  players: Player[];
  stars: Star[];
  winnerId: null | PlayerId;
}

export interface GalaxyMap {
  height: number;
  seed: number;
  width: number;
}

export interface HyperspaceLane {
  aStarId: StarId;
  bStarId: StarId;
  id: string;
  ownerId: PlayerId;
}

export interface Player {
  color: number;
  id: PlayerId;
  isHuman: boolean;
  name: string;
}

export interface Star {
  forces: number;
  id: StarId;
  name: string;
  ownerId: null | PlayerId;
  resourceEfficiency: number;
  upgrades: StarUpgrades;
  x: number;
  y: number;
}

export interface StarUpgrades {
  factory: number;
  turret: number;
}
