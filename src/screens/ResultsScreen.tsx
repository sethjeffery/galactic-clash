import type { ReactNode } from "react";
import type { CSSProperties } from "react";

import { ArrowLeft, Crown, Factory, RotateCcw, Shield, Sparkles, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { HUMAN_PLAYER_ID } from "../game/constants";
import { formatForces } from "../game/math";
import { loadGame } from "../game/persistence/storage";

import "./ResultsScreen.css";

const STARFIELD_BASE_HUE_DEGREES = 194;

export function ResultsScreen() {
  const { gameId } = useParams();
  const state = gameId ? loadGame(gameId) : null;
  const winner = state?.players.find((player) => player.id === state.winnerId);
  const winnerStars = state?.stars.filter((star) => star.ownerId === winner?.id) ?? [];
  const totalForces = winnerStars.reduce((sum, star) => sum + star.forces, 0);
  const factories = winnerStars.reduce((sum, star) => sum + star.upgrades.factory, 0);
  const turrets = winnerStars.reduce((sum, star) => sum + star.upgrades.turret, 0);
  const elapsedSeconds = state ? Math.floor(state.elapsedSeconds) : 0;
  const winnerColor = winner ? colorToCssColor(winner.color) : "#4cc9f0";
  const winnerHueRotation = winner ? `${colorToHueRotationDegrees(winner.color)}deg` : "0deg";
  const resultTitle = winner
    ? winner.id === HUMAN_PLAYER_ID
      ? `${winner.name} victorious`
      : `Sector lost to ${winner.name}`
    : "No victor recorded";
  const resultStyle = {
    "--winner-color": winnerColor,
    "--winner-hue-rotate": winnerHueRotation,
  } as CSSProperties;

  return (
    <main className="screen results-screen" style={resultStyle}>
      <section className="results-panel">
        <div className="victory-title screen-enter delay-1">
          <Crown size={42} />
          <h1>{resultTitle}</h1>
        </div>

        <div className="results-stats screen-enter delay-2">
          <AnimatedStat
            formatValue={formatElapsedTime}
            icon={<Timer size={20} />}
            label="Final time"
            value={elapsedSeconds}
          />
          <AnimatedStat
            formatValue={(value) => value.toString()}
            icon={<Sparkles size={20} />}
            label="Stars held"
            value={winnerStars.length}
          />
          <AnimatedStat
            formatValue={formatForces}
            icon={<Crown size={20} />}
            label="Forces remaining"
            value={totalForces}
          />
          <AnimatedStat
            formatValue={(value) => value.toString()}
            icon={<Factory size={20} />}
            label="Factories"
            value={factories}
          />
          <AnimatedStat
            formatValue={(value) => value.toString()}
            icon={<Shield size={20} />}
            label="Turrets"
            value={turrets}
          />
        </div>

        <div className="home-actions screen-enter delay-3">
          <Link className="primary-action" to="/new">
            <RotateCcw size={18} />
            New Game
          </Link>
          <Link className="secondary-action" to="/">
            <ArrowLeft size={18} />
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}

function AnimatedStat({
  formatValue,
  icon,
  label,
  value,
}: {
  formatValue: (value: number) => string;
  icon: ReactNode;
  label: string;
  value: number;
}) {
  const animatedValue = useCountUp(value);

  return <Stat icon={icon} label={label} value={formatValue(animatedValue)} />;
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="result-stat">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function useCountUp(target: number) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;
    const duration = 1200;
    const startDelay = 360;

    timeout = window.setTimeout(() => {
      const delayedStart = performance.now();

      frame = window.requestAnimationFrame(function step(now: number) {
        const progress = Math.min(1, (now - delayedStart) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);

        setValue(Math.round(target * eased));

        if (progress < 1) {
          frame = window.requestAnimationFrame(step);
        }
      });
    }, startDelay);

    return () => {
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
    };
  }, [target]);

  return value;
}

function formatElapsedTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${minutes}m ${seconds}s`;
}

function colorToCssColor(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function colorToHueRotationDegrees(color: number) {
  const hue = colorToHueDegrees(color);
  const rotation = hue - STARFIELD_BASE_HUE_DEGREES;

  return Math.round(((rotation + 180) % 360) - 180);
}

function colorToHueDegrees(color: number) {
  const red = ((color >> 16) & 255) / 255;
  const green = ((color >> 8) & 255) / 255;
  const blue = (color & 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  if (delta === 0) {
    return STARFIELD_BASE_HUE_DEGREES;
  }

  if (max === red) {
    return normalizeHueDegrees(60 * (((green - blue) / delta) % 6));
  }

  if (max === green) {
    return normalizeHueDegrees(60 * ((blue - red) / delta + 2));
  }

  return normalizeHueDegrees(60 * ((red - green) / delta + 4));
}

function normalizeHueDegrees(hue: number) {
  return (hue + 360) % 360;
}
