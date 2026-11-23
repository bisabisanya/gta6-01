// The city of Solmar, grown from a seed: a road grid, blocks of buildings, a
// park and a plaza left open, a beach and the ocean to the east, and the story
// landmarks (garage, bank, hospital, hideout, hotel, pier). Collision is
// rectangles for buildings and a hard edge at the water.

import {
  WORLD_W, WORLD_H, ROAD_W, ROAD_LINES_X, ROAD_LINES_Y, SAND_X, SEA_X,
} from './config.js';
import { makeRng } from './rng.js';

const WALLS = [
  '#e8a34c', '#d97b4f', '#c96f8e', '#7fb3a8', '#8fa8c9', '#e0c06a',
  '#b98a5e', '#9db98a', '#c9a0c9', '#e07856', '#6fa8a0', '#d9b48f',
];
const ROOFTOPS = ['#5d4a68', '#3f5a6e', '#6e4a3f', '#4a6e52', '#715a7a', '#556b7d'];
const NEON_SIGNS = ['#ff5da2', '#37e0c8', '#ffd23f', '#7aa8ff'];

function onRoad(x, y) {
  for (const rx of ROAD_LINES_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROAD_LINES_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

// The open rectangles between the roads; buildings are placed inside them.
function cityBlocks() {
  const out = [];
  for (let i = 0; i < ROAD_LINES_X.length; i += 1) {
    for (let j = 0; j < ROAD_LINES_Y.length; j += 1) {
      const x0 = ROAD_LINES_X[i] + ROAD_W / 2 + 8;
      const y0 = ROAD_LINES_Y[j] + ROAD_W / 2 + 8;
      const x1 = (ROAD_LINES_X[i + 1] ?? WORLD_W) - ROAD_W / 2 - 8;
      const y1 = (ROAD_LINES_Y[j + 1] ?? WORLD_H) - ROAD_W / 2 - 8;
      if (x1 - x0 > 60 && y1 - y0 > 60) out.push({ x0, y0, x1, y1, col: i, row: j });
    }
  }
  return out;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const lamps = [];
  const benches = [];
  const blocks = cityBlocks();

  // Palm Court Park and the plaza stay open — no buildings there.
  const park = blocks.find((b) => b.col === 2 && b.row === 2);
  const plaza = blocks.find((b) => b.col === 3 && b.row === 1);

  for (const block of blocks) {
    if (block === park || block === plaza) continue;
    const bw = block.x1 - block.x0;
    const bh = block.y1 - block.y0;
    // Four lots per block, most holding one building each.
    for (let gx = 0; gx < 2; gx += 1) {
      for (let gy = 0; gy < 2; gy += 1) {
        if (!rng.maybe(0.82)) continue;
        const lx0 = block.x0 + (gx * bw) / 2 + 8;
        const ly0 = block.y0 + (gy * bh) / 2 + 8;
        const lx1 = block.x0 + ((gx + 1) * bw) / 2 - 8;
        const ly1 = block.y0 + ((gy + 1) * bh) / 2 - 8;
        const w = rng.between(70, Math.max(72, lx1 - lx0));
        const h = rng.between(60, Math.max(62, ly1 - ly0));
        buildings.push({
          x: rng.between(lx0, Math.max(lx0, lx1 - w)),
          y: rng.between(ly0, Math.max(ly0, ly1 - h)),
          w, h,
          tall: rng.whole(14, 46),
          color: rng.from(WALLS),
          roof: rng.from(ROOFTOPS),
          neon: rng.maybe(0.35) ? rng.from(NEON_SIGNS) : null,
          hasSign: rng.maybe(0.3),
        });
      }
    }
  }

  // Palms along the sand and around the park; lamps along every road.
  for (let y = 120; y < WORLD_H; y += 130) palms.push({ x: SAND_X - 26 + rng.between(-8, 8), y });
  for (let y = 200; y < WORLD_H; y += 260) palms.push({ x: park.x0 + 40, y: park.y0 + 60 });
  for (let y = 260; y < WORLD_H; y += 260) palms.push({ x: park.x1 - 40, y: park.y1 - 60 });
  for (const rx of ROAD_LINES_X) {
    for (let y = 120; y < WORLD_H; y += 300) lamps.push({ x: rx + ROAD_W / 2 + 6, y });
  }
  for (const ry of ROAD_LINES_Y) {
    for (let x = 120; x < WORLD_W; x += 300) lamps.push({ x, y: ry + ROAD_W / 2 + 6 });
  }
  for (let i = 0; i < 10; i += 1) benches.push({ x: park.x0 + 60 + i * 46, y: park.y0 + 130 });

  const spots = {
    garage: { x: 900, y: 800, name: "Eddie's Garage" },
    bank: { x: 2100, y: 800, name: 'Solmar National Bank' },
    hospital: { x: 900, y: 1800, name: 'Solmar General' },
    hideout: { x: 1500, y: 2300, name: 'Mara’s Hideout' },
    hotel: { x: 2700, y: 1300, name: 'Palmetto Hotel' },
    pier: { x: 3400, y: 1300, name: 'Sunset Pier' },
    park: { x: (park.x0 + park.x1) / 2, y: (park.y0 + park.y1) / 2, name: 'Palm Court Park' },
  };

  function blocked(x, y, r) {
    if (x < r || y < r || x > SEA_X - r || y > WORLD_H - r) return true;
    if (x > SEA_X - 40) return true;
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  // A car is a box: check its centre and corners against the same test.
  function blockedForCar(x, y, halfLen, halfWid, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pts = [[0, 0], [halfLen, halfWid], [halfLen, -halfWid], [-halfLen, halfWid], [-halfLen, -halfWid]];
    for (const [px, py] of pts) {
      if (blocked(x + px * cos - py * sin, y + px * sin + py * cos, 8)) return true;
    }
    return false;
  }

  function closestRoad(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROAD_LINES_X) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { x: rx, y, along: true }; }
    }
    for (const ry of ROAD_LINES_Y) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { x, y: ry, along: false }; }
    }
    return best;
  }

  function randomRoadSpot() {
    if (rng.maybe(0.5)) {
      return {
        x: rng.from(ROAD_LINES_X) + rng.between(-ROAD_W / 4, ROAD_W / 4),
        y: rng.between(80, WORLD_H - 80),
        along: true,
      };
    }
    return {
      x: rng.between(80, SAND_X - 80),
      y: rng.from(ROAD_LINES_Y) + rng.between(-ROAD_W / 4, ROAD_W / 4),
      along: false,
    };
  }

  function randomWalkSpot() {
    const p = randomRoadSpot();
    return {
      x: p.x + rng.between(-ROAD_W / 2 - 30, ROAD_W / 2 + 30),
      y: p.y + rng.between(-ROAD_W / 2 - 30, ROAD_W / 2 + 30),
    };
  }

  return {
    seed, buildings, palms, lamps, benches, spots, park, plaza,
    onRoad, blocked, blockedForCar, closestRoad, randomRoadSpot, randomWalkSpot,
  };
}
