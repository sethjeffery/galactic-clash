import { Play, Settings } from "lucide-react";
import { Link } from "react-router-dom";

import { loadGameIndex } from "../game/persistence/storage";

export function HomeScreen() {
  const savedGames = loadGameIndex();

  return (
    <main className="screen home-screen">
      <section className="game-menu">
        <div className="menu-title">
          <h1 className="crawl-entry delay-1">Galactic Clash</h1>
          <span className="crawl-entry delay-2">Fast tactical star conquest</span>
        </div>

        <div className="menu-actions screen-enter delay-3">
          <Link className="menu-action primary-action" to="/new">
            <Play size={18} />
            New Game
          </Link>
          {savedGames[0] ? (
            <Link className="menu-action secondary-action" to={`/game/${savedGames[0]}`}>
              <Settings size={18} />
              Continue
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
