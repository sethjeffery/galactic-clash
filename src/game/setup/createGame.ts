import type { GameConfig, GameState, GalaxyMap, Player, Star } from "../types";

import { AI_PLAYER_IDS, HUMAN_PLAYER_ID } from "../constants";
import { distance, makeId, seededRandom } from "../math";
import { STAR_NAMES } from "./starNames";

interface SizePreset {
  height: number;
  starCount: number;
  width: number;
}

const SIZE_PRESETS: Record<GameConfig["mapSize"], SizePreset> = {
  compact: { height: 980, starCount: 24, width: 1500 },
  expansive: { height: 1500, starCount: 48, width: 2350 },
  standard: { height: 1220, starCount: 34, width: 1850 },
};

const AI_PLAYER_TEMPLATES: Array<Pick<Player, "color" | "name">> = [
  { color: 0xff5c7a, name: "Crimson Directorate" },
  { color: 0xf7b955, name: "Helios Combine" },
  { color: 0x9b7dff, name: "Violet Syndicate" },
];

export function createGame(config: GameConfig): GameState {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const preset = SIZE_PRESETS[config.mapSize];
  const map: GalaxyMap = { height: preset.height, seed, width: preset.width };
  const random = seededRandom(seed);
  const stars = placeStars(random, preset, map);
  const players = createPlayers(config);

  assignStartingClusters(stars, players, map);

  return {
    aiUnlockedAt: null,
    battles: [],
    buildTasks: [],
    config,
    createdAt: new Date().toISOString(),
    elapsedSeconds: 0,
    fleets: [],
    hyperspaceLanes: [],
    id: makeId("game"),
    map,
    phase: "playing",
    players,
    stars,
    winnerId: null,
  };
}

function createPlayers(config: GameConfig): Player[] {
  return [
    {
      color: 0x4cc9f0,
      id: HUMAN_PLAYER_ID,
      isHuman: true,
      name: "Orion Compact",
    },
    ...AI_PLAYER_TEMPLATES.slice(0, config.opponentCount).flatMap((template, index) => {
      const id = AI_PLAYER_IDS[index];

      return id
        ? [{ ...template, id, isHuman: false }]
        : [];
    }),
  ];
}

function assignStartingClusters(stars: Star[], players: Player[], map: GalaxyMap) {
  const anchors = getStartingAnchors(players.length, map);

  players.forEach((player, index) => {
    const anchor = anchors[index] ?? anchors[0] ?? { x: map.width / 2, y: map.height / 2 };
    const availableStars = [...stars]
      .filter((star) => star.ownerId === null)
      .sort((a, b) => distance(a, anchor) - distance(b, anchor));

    for (const star of availableStars.slice(0, 3)) {
      star.forces = 38;
      star.ownerId = player.id;
      star.resourceEfficiency = Math.max(star.resourceEfficiency, 1);
    }
  });
}

function getStartingAnchors(playerCount: number, map: GalaxyMap) {
  const centerX = map.width / 2;
  const centerY = map.height / 2;
  const radiusX = map.width * 0.38;
  const radiusY = map.height * 0.34;

  return Array.from({ length: playerCount }, (_, index) => {
    const angle = Math.PI + (index * Math.PI * 2) / playerCount;

    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  });
}

function placeStars(random: () => number, preset: SizePreset, map: GalaxyMap) {
  const stars: Star[] = [];
  const minimumDistance = Math.min(map.width, map.height) / 10.5;

  for (let index = 0; index < preset.starCount; index += 1) {
    let attempts = 0;
    let x = 0;
    let y = 0;

    do {
      x = 90 + random() * (map.width - 180);
      y = 90 + random() * (map.height - 180);
      attempts += 1;
    } while (
      attempts < 80 &&
      stars.some((star) => distance(star, { x, y }) < minimumDistance * (0.72 + random() * 0.38))
    );

    stars.push({
      forces: 12 + Math.floor(random() * 18),
      id: `star-${index}`,
      name: STAR_NAMES[index % STAR_NAMES.length] ?? `Star ${index + 1}`,
      ownerId: null,
      resourceEfficiency: 0.65 + random() * 1.15,
      upgrades: {
        factory: 0,
        turret: 0,
      },
      x,
      y,
    });
  }

  return stars;
}
