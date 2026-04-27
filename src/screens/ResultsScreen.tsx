import type { ReactNode } from "react";

import { ArrowLeft, Crown, Factory, RotateCcw, Shield, Sparkles, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { formatForces } from "../game/math";
import { loadGame } from "../game/persistence/storage";

import "./ResultsScreen.css";

export function ResultsScreen() {
  const { gameId } = useParams();
  const state = gameId ? loadGame(gameId) : null;
  const winner = state?.players.find((player) => player.id === state.winnerId);
  const winnerStars = state?.stars.filter((star) => star.ownerId === winner?.id) ?? [];
  const totalForces = winnerStars.reduce((sum, star) => sum + star.forces, 0);
  const factories = winnerStars.reduce((sum, star) => sum + star.upgrades.factory, 0);
  const turrets = winnerStars.reduce((sum, star) => sum + star.upgrades.turret, 0);
  const elapsedSeconds = state ? Math.floor(state.elapsedSeconds) : 0;

  return (
    <main className="screen results-screen">
      <section className="results-panel">
        <div className="victory-title screen-enter delay-1">
          <Crown size={42} />
          <h1>{winner ? `${winner.name} victorious` : "No victor recorded"}</h1>
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
