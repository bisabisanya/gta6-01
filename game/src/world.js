// City generation for Solmar: a road grid, seeded blocks of buildings, a park, a beach and
// the ocean, plus the story landmarks (garage, bank, hospital, hideout, hotel). All geometry is
// deterministic from the seed. Collision is axis-aligned rectangles (buildings) and the ocean.
import { WORLD, ROADS_X, ROADS_Y, ROAD_WIDTH, BEACH_X, OCEAN_X } from './config.js';
import { createRandom } from './random.js';

const PALETTE = [
  '#e8a34c', '#d97b4f', '#c96f8e', '#7fb3a8', '#8fa8c9', '#e0c06a',
  '#b98a5e', '#9db98a', '#c9a0c9', '#e07856', '#6fa8a0', '#d9b48f',
];
const ROOFS = ['#5d4a68', '#3f5a6e', '#6e4a3f', '#4a6e52', '#715a7a', '#556b7d'];

function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_WIDTH / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_WIDTH / 2) return true;
  return false;
}

function blockRects() {
  const rects = [];
  for (let i = 0; i < ROADS_X.length; i += 1) {
    for (let j = 0; j < ROADS_Y.length; j += 1) {
      const x0 = ROADS_X[i] + ROAD_WIDTH / 2 + 8;
      const y0 = ROADS_Y[j] + ROAD_WIDTH / 2 + 8;
      const x1 = (ROADS_X[i + 1] ?? WORLD.width) - ROAD_WIDTH / 2 - 8;
      const y1 = (ROADS_Y[j + 1] ?? WORLD.height) - ROAD_WIDTH / 2 - 8;
      if (x1 - x0 > 60 && y1 - y0 > 60) rects.push({ x0, y0, x1, y1, i, j });
    }
  }
  return rects;
}

export function createWorld(seed) {
  const rng = createRandom(seed);
  const buildings = [];
  const palms = [];
  const lamps = [];
  const benches = [];
  const blocks = blockRects();

  // The park block (between roads 1500/2100 x 1300/1800) and the plaza stay open.
  const parkBlock = blocks.find((b) => b.i === 2 && b.j === 2);
  const plazaBlock = blocks.find((b) => b.i === 3 && b.j === 1);

  for (const block of blocks) {
    if (block === parkBlock || block === plazaBlock) continue;
    // Subdivide the block into a 2x2 grid of lots; most lots get one building, so the
    // city reads as dense blocks rather than empty lawns.
    const bw = block.x1 - block.x0;
    const bh = block.y1 - block.y0;
    for (let gx = 0; gx < 2; gx += 1) {
      for (let gy = 0; gy < 2; gy += 1) {
        if (!rng.chance(0.82)) continue;
        const lotX0 = block.x0 + (gx * bw) / 2 + 8;
        const lotY0 = block.y0 + (gy * bh) / 2 + 8;
        const lotX1 = block.x0 + ((gx + 1) * bw) / 2 - 8;
        const lotY1 = block.y0 + ((gy + 1) * bh) / 2 - 8;
        const w = rng.range(70, Math.max(72, lotX1 - lotX0));
        const h = rng.range(60, Math.max(62, lotY1 - lotY0));
        const x = rng.range(lotX0, Math.max(lotX0, lotX1 - w));
        const y = rng.range(lotY0, Math.max(lotY0, lotY1 - h));
        buildings.push({
          x, y, w, h,
          height: rng.int(14, 46),
          color: rng.pick(PALETTE),
          roof: rng.pick(ROOFS),
          neon: rng.chance(0.35) ? rng.pick(['#ff5da2', '#37e0c8', '#ffd23f', '#7aa8ff']) : null,
          sign: rng.chance(0.3),
        });
      }
    }
  }

  // Palms line the beach and the park; lamps line every road.
  for (let y = 120; y < WORLD.height; y += 130) palms.push({ x: BEACH_X - 26 + rng.range(-8, 8), y });
  for (let y = 200; y < WORLD.height; y += 260) palms.push({ x: parkBlock.x0 + 40, y: parkBlock.y0 + 60 });
  for (let y = 260; y < WORLD.height; y += 260) palms.push({ x: parkBlock.x1 - 40, y: parkBlock.y1 - 60 });
  for (const rx of ROADS_X) for (let y = 120; y < WORLD.height; y += 300) lamps.push({ x: rx + ROAD_WIDTH / 2 + 6, y });
  for (const ry of ROADS_Y) for (let x = 120; x < WORLD.width; x += 300) lamps.push({ x, y: ry + ROAD_WIDTH / 2 + 6 });
  for (let i = 0; i < 10; i += 1) benches.push({ x: parkBlock.x0 + 60 + i * 46, y: parkBlock.y0 + 130 });

  const landmarks = {
    garage: { x: 900, y: 800, label: "Eddie's Garage" },
    bank: { x: 2100, y: 800, label: 'Solmar National Bank' },
    hospital: { x: 900, y: 1800, label: 'Solmar General' },
    hideout: { x: 1500, y: 2300, label: 'Mara\u2019s Hideout' },
    hotel: { x: 2700, y: 1300, label: 'Palmetto Hotel' },
    pier: { x: 3400, y: 1300, label: 'Sunset Pier' },
    park: { x: (parkBlock.x0 + parkBlock.x1) / 2, y: (parkBlock.y0 + parkBlock.y1) / 2, label: 'Palm Court Park' },
  };

  function collides(x, y, r) {
    if (x < r || y < r || x > OCEAN_X - r || y > WORLD.height - r) return true;
    if (x > OCEAN_X - 40) return true;
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  function collidesCar(x, y, halfLen, halfWid, angle) {
    // Cheap circle approximation: sample the car's corners and centre.
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pts = [[0, 0], [halfLen, halfWid], [halfLen, -halfWid], [-halfLen, halfWid], [-halfLen, -halfWid]];
    for (const [px, py] of pts) {
      const wx = x + px * cos - py * sin;
      const wy = y + px * sin + py * cos;
      if (collides(wx, wy, 8)) return true;
    }
    return false;
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROADS_X) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
    }
    for (const ry of ROADS_Y) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
    }
    return best;
  }

  function randomRoadPoint() {
    if (rng.chance(0.5)) {
      return { x: rng.pick(ROADS_X) + rng.range(-ROAD_WIDTH / 4, ROAD_WIDTH / 4), y: rng.range(80, WORLD.height - 80), vertical: true };
    }
    return { x: rng.range(80, BEACH_X - 80), y: rng.pick(ROADS_Y) + rng.range(-ROAD_WIDTH / 4, ROAD_WIDTH / 4), vertical: false };
  }

  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    return { x: p.x + rng.range(-ROAD_WIDTH / 2 - 30, ROAD_WIDTH / 2 + 30), y: p.y + rng.range(-ROAD_WIDTH / 2 - 30, ROAD_WIDTH / 2 + 30) };
  }

  return {
    seed, buildings, palms, lamps, benches, landmarks, parkBlock, plazaBlock,
    onRoad, collides, collidesCar, nearestRoadPoint, randomRoadPoint, randomSidewalkPoint,
  };
}
