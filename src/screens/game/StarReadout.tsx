import type { Star } from "../../game/types";

import { Factory, Shield, Sparkles, Swords } from "lucide-react";

import { getGrowthPerSecond } from "../../game/engine/economy";
import { formatForces } from "../../game/math";

import "./StarReadout.css";

export function StarReadout({ star }: { star: Star }) {
  return (
    <div className="star-readout">
      <h2>{star.name}</h2>
      <dl>
        <div className="star-stat forces-stat">
          <dt>
            <Swords size={15} />
            <span>Forces</span>
          </dt>
          <dd>{formatForces(star.forces)}</dd>
        </div>
        <div className="star-stat growth-stat">
          <dt>
            <Sparkles size={15} />
            <span>Growth</span>
          </dt>
          <dd>{getGrowthPerSecond(star).toFixed(2)}/s</dd>
        </div>
        <div className="star-stat factory-stat">
          <dt>
            <Factory size={15} />
            <span>Factory</span>
          </dt>
          <dd>{star.upgrades.factory}</dd>
        </div>
        <div className="star-stat turret-stat">
          <dt>
            <Shield size={15} />
            <span>Turret</span>
          </dt>
          <dd>{star.upgrades.turret}</dd>
        </div>
      </dl>
    </div>
  );
}
