import type { Difficulty, GameConfig, MapSize, OpponentCount } from "../game/types";
import type { ReactElement } from "react";

import { ArrowLeft, Brain, Gauge, Play, Swords } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { saveGame } from "../game/persistence/storage";
import { createGame } from "../game/setup/createGame";

interface DifficultyOption {
  icon: ReactElement;
  label: string;
  value: Difficulty;
}

interface MapOption {
  description: string;
  label: string;
  stars: number;
  value: MapSize;
}

const MAP_OPTIONS: MapOption[] = [
  {
    description: "Short lanes and early contact.",
    label: "Compact",
    stars: 24,
    value: "compact",
  },
  {
    description: "Balanced scouting and pressure.",
    label: "Standard",
    stars: 34,
    value: "standard",
  },
  {
    description: "Wide fronts and longer routes.",
    label: "Expansive",
    stars: 48,
    value: "expansive",
  },
];

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  {
    icon: <Gauge size={20} />,
    label: "Cadet",
    value: "cadet",
  },
  {
    icon: <Brain size={20} />,
    label: "Admiral",
    value: "admiral",
  },
  {
    icon: <Swords size={20} />,
    label: "Warlord",
    value: "warlord",
  },
];

const OPPONENT_OPTIONS: OpponentCount[] = [1, 2, 3];

export function NewGameScreen() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<GameConfig>({
    difficulty: "admiral",
    mapSize: "standard",
    opponentCount: 1,
    winCondition: "capture_all_enemy_stars",
  });

  function startGame() {
    const game = createGame(config);
    saveGame(game);
    void navigate(`/game/${game.id}`);
  }

  return (
    <main className="screen setup-screen">
      <header className="setup-nav screen-enter delay-1">
        <Link className="icon-link" to="/">
          <ArrowLeft size={18} />
          Back
        </Link>
      </header>

      <section className="setup-panel enhanced-setup">
        <h1 className="screen-enter delay-1">Create your game</h1>

        <fieldset className="screen-enter delay-2">
          <legend>Map size</legend>
          <div className="map-option-grid">
            {MAP_OPTIONS.map((option) => (
              <button
                className={config.mapSize === option.value ? "map-option active" : "map-option"}
                key={option.value}
                onClick={() => setConfig((current) => ({ ...current, mapSize: option.value }))}
                type="button"
              >
                <MapPreview size={option.value} />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.stars} stars</small>
                </span>
                <em>{option.description}</em>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="screen-enter delay-3">
          <legend>Opponents</legend>
          <div className="opponent-grid">
            {OPPONENT_OPTIONS.map((option) => (
              <button
                className={config.opponentCount === option ? "opponent-option active" : "opponent-option"}
                key={option}
                onClick={() => setConfig((current) => ({ ...current, opponentCount: option }))}
                type="button"
              >
                <strong>{option}</strong>
                <span>{option === 1 ? "AI command" : "AI commands"}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="screen-enter delay-4">
          <legend>AI difficulty</legend>
          <div className="difficulty-grid compact-difficulty-grid">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                className={
                  config.difficulty === option.value ? "difficulty-option active" : "difficulty-option"
                }
                key={option.value}
                onClick={() => setConfig((current) => ({ ...current, difficulty: option.value }))}
                type="button"
              >
                <span className="difficulty-icon">{option.icon}</span>
                <strong>{option.label}</strong>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="launch-strip screen-enter delay-4">
          <div>
            <span>Capture every enemy star</span>
          </div>
          <button className="primary-action" onClick={startGame} type="button">
            <Play size={18} />
            Launch Sector
          </button>
        </div>
      </section>
    </main>
  );
}

function MapPreview({ size }: { size: MapSize }) {
  const points = {
    compact: [
      [22, 42],
      [38, 26],
      [48, 55],
      [68, 35],
      [78, 60],
    ],
    expansive: [
      [14, 50],
      [24, 24],
      [34, 70],
      [48, 38],
      [58, 62],
      [70, 24],
      [84, 48],
      [76, 76],
    ],
    standard: [
      [18, 54],
      [30, 30],
      [44, 62],
      [56, 36],
      [72, 52],
      [82, 72],
    ],
  }[size];

  const path = points.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <svg className="map-preview" viewBox="0 0 100 100" role="img">
      <polyline points={path} />
      {points.map(([x, y], index) => (
        <circle cx={x} cy={y} key={`${x}-${y}`} r={index === 0 || index === points.length - 1 ? 4 : 3} />
      ))}
    </svg>
  );
}
