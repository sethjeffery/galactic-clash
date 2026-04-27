import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { GameScreen } from "../screens/GameScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { NewGameScreen } from "../screens/NewGameScreen";
import { ResultsScreen } from "../screens/ResultsScreen";
import { CruiseStarfield } from "../ui/CruiseStarfield";

import "./App.css";

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const location = useLocation();
  const routeClass = location.pathname.startsWith("/game/")
    ? "route-game"
    : location.pathname.startsWith("/results/")
      ? "route-results"
      : "route-menu";

  return (
    <div className={`app-shell ${routeClass}`}>
      <div className="app-ambience" aria-hidden="true">
        <CruiseStarfield />
      </div>
      <Routes>
        <Route element={<HomeScreen />} path="/" />
        <Route element={<NewGameScreen />} path="/new" />
        <Route element={<GameScreen />} path="/game/:gameId" />
        <Route element={<ResultsScreen />} path="/results/:gameId" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </div>
  );
}
