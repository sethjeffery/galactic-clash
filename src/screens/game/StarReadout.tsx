import type { Star } from "../../game/types";

import { getGrowthPerSecond } from "../../game/engine/economy";
import { formatForces } from "../../game/math";

import "./StarReadout.css";

export function StarReadout({ star }: { star: Star }) {
  return (
    <div className="star-readout">
      <h2>{star.name}</h2>
      <dl>
        <div>
          <dt>Forces</dt>
          <dd>{formatForces(star.forces)}</dd>
        </div>
        <div>
          <dt>Growth</dt>
          <dd>{getGrowthPerSecond(star).toFixed(2)}/s</dd>
        </div>
        <div>
          <dt>Factory</dt>
          <dd>{star.upgrades.factory}</dd>
        </div>
        <div>
          <dt>Turret</dt>
          <dd>{star.upgrades.turret}</dd>
        </div>
      </dl>
    </div>
  );
}
