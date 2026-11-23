// Traffic, pedestrians, parked cars and police. Traffic follows the road grid; pedestrians
// stroll the sidewalks and flee gunfire; police cars spawn by wanted level and ram the player,
// while foot cops chase a player on foot and bust them if they stay close.
import { CAR, WANTED, WORLD, ROAD_WIDTH } from './config.js';
import { clamp, dist2, angleDiff } from './random.js';

const CAR_COLORS = ['#c94f4f', '#4f7ec9', '#e0b13c', '#7a4fc9', '#4fc98a', '#d8d8d8', '#3a3a3a', '#e07840', '#5fb3c9'];
const PED_COLORS = ['#e86a6a', '#6a9ae8', '#e8c96a', '#8ae86a', '#c96ad8', '#e8a06a', '#6ad8d0'];

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color, kind: kind || 'traffic',
    length: CAR.length, width: CAR.width, hp: 100,
    vertical: Math.abs(Math.sin(angle)) > 0.7,
    dir: 1, cruise: 120 + Math.random() * 60, stuck: 0,
  };
}

export function createEntities(world, rng) {
  const traffic = [];
  const parked = [];
  const peds = [];
  const cops = [];
  for (let i = 0; i < 14; i += 1) {
    const p = world.randomRoadPoint();
    const angle = p.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const car = makeCar(p.x, p.y, angle, rng.pick(CAR_COLORS), 'traffic');
    car.vertical = p.vertical;
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.cruise = rng.range(110, 190);
    car.speed = car.cruise;
    traffic.push(car);
  }
  for (let i = 0; i < 10; i += 1) {
    const p = world.randomRoadPoint();
    const angle = p.vertical ? Math.PI / 2 : 0;
    const offset = rng.chance(0.5) ? ROAD_WIDTH / 2 - 14 : -(ROAD_WIDTH / 2 - 14);
    parked.push(makeCar(p.x + (p.vertical ? offset : 0), p.y + (p.vertical ? 0 : offset), angle, rng.pick(CAR_COLORS), 'parked'));
  }
  for (let i = 0; i < 24; i += 1) {
    const p = world.randomSidewalkPoint();
    peds.push({
      x: p.x, y: p.y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 55),
      color: rng.pick(PED_COLORS), flee: 0, alive: true, bob: rng.range(0, 6),
      targetX: p.x, targetY: p.y, wait: rng.range(0, 4),
    });
  }
  return { traffic, parked, peds, cops, footCops: [] };
}

function carAhead(list, car, gap) {
  for (const other of list) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = car.vertical ? dy * car.dir : dx * car.dir;
    const lateral = car.vertical ? Math.abs(dx) : Math.abs(dy);
    if (forward > 0 && forward < gap && lateral < 26) return true;
  }
  return false;
}

export function stepTraffic(state, dt) {
  const { world, entities } = state;
  const all = [...entities.traffic, ...entities.parked.filter((c) => c.kind === 'traffic')];
  for (const car of entities.traffic) {
    // A shoved car that ends up off the road respawns on a fresh one.
    if (!world.onRoad(car.x, car.y)) {
      const p = world.randomRoadPoint();
      car.x = p.x;
      car.y = p.y;
      car.vertical = p.vertical;
      car.angle = p.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.speed = car.cruise;
      continue;
    }
    const want = carAhead(all, car, 90) ? 0 : car.cruise;
    car.speed += clamp(want - car.speed, -260 * dt, 160 * dt);
    const step = car.speed * car.dir * dt;
    if (car.vertical) car.y += step;
    else car.x += step;
    // Wrap around the city edge onto a fresh road.
    if (car.x < 40 || car.x > 3440 || car.y < 40 || car.y > WORLD.height - 40) {
      const p = world.randomRoadPoint();
      car.x = p.x;
      car.y = p.y;
      car.vertical = p.vertical;
      car.angle = p.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.speed = car.cruise;
    }
  }
}

export function stepPedestrians(state, dt) {
  const { player } = state;
  for (const ped of state.entities.peds) {
    if (!ped.alive) continue;
    ped.bob += dt * 8;
    const d2 = dist2(ped.x, ped.y, player.x, player.y);
    if (d2 < 260 * 260) ped.flee = 2.5;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - player.y, ped.x - player.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 120 * dt;
      ped.y += Math.sin(away) * 120 * dt;
      continue;
    }
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      const p = state.world.randomSidewalkPoint();
      ped.targetX = p.x;
      ped.targetY = p.y;
      ped.wait = 1 + Math.random() * 4;
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * dt;
    ped.y += (dy / d) * ped.speed * dt;
  }
}

export function spawnCop(state) {
  const { world, player } = state;
  const p = world.randomRoadPoint();
  // Prefer a road point a few blocks from the player so the chase arrives visibly.
  let tries = 0;
  let spot = p;
  while (tries < 8 && dist2(spot.x, spot.y, player.x, player.y) < 500 * 500) {
    spot = world.randomRoadPoint();
    tries += 1;
  }
  const cop = makeCar(spot.x, spot.y, Math.atan2(player.y - spot.y, player.x - spot.x), '#20242e', 'cop');
  cop.speed = 200;
  cop.siren = 0;
  state.entities.cops.push(cop);
}

export function stepPolice(state, dt) {
  const { player, entities } = state;
  const wanted = player.wanted;
  const wantCount = WANTED.copCount[wanted.stars] || 0;
  if (entities.cops.length < wantCount && Math.random() < dt * 0.8) spawnCop(state);
  if (entities.cops.length > wantCount) entities.cops.splice(wantCount);

  for (const cop of entities.cops) {
    cop.siren += dt;
    const targetAngle = Math.atan2(player.y - cop.y, player.x - cop.x);
    const diff = angleDiff(cop.angle, targetAngle);
    cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const top = WANTED.copSpeed[wanted.stars] || 300;
    cop.speed = clamp(cop.speed + (top - cop.speed) * dt, 0, top);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!state.world.collidesCar(nx, ny, CAR.length / 2, CAR.width / 2, cop.angle)) {
      cop.x = nx;
      cop.y = ny;
    } else {
      cop.angle += 1.2 * dt;
      cop.speed *= 0.6;
    }
    // Ram the player: on foot it hurts, in a car it shoves and damages.
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (d < 46) {
      if (player.mode === 'foot') {
        player.health -= 26 * dt;
        state.events.push({ type: 'hit', amount: 26 * dt });
      } else if (player.car) {
        player.car.hp -= 14 * dt;
        player.car.speed *= 1 - 0.6 * dt;
        const push = Math.atan2(player.y - cop.y, player.x - cop.x);
        player.x += Math.cos(push) * 30 * dt;
        player.y += Math.sin(push) * 30 * dt;
        state.events.push({ type: 'crash' });
      }
    }
    // Bust: a cop car sitting on a player on foot for long enough ends the run.
    if (player.mode === 'foot' && d < WANTED.bustRadius) {
      state.bustTimer += dt;
      if (state.bustTimer > WANTED.bustTime) state.events.push({ type: 'busted' });
    }
  }
  if (entities.cops.length === 0) state.bustTimer = 0;

  // Foot cops only join once the heat is serious and the player is on foot.
  if (wanted.stars >= 2 && player.mode === 'foot') {
    if (state.entities.footCops.length < wanted.stars - 1 && Math.random() < dt * 0.4) {
      const p = state.world.randomSidewalkPoint();
      state.entities.footCops.push({ x: p.x, y: p.y, angle: 0, speed: 195, color: '#20242e' });
    }
  }
  for (const cop of state.entities.footCops) {
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    const a = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.speed * dt;
    cop.y += Math.sin(a) * cop.speed * dt;
    if (d < WANTED.bustRadius) {
      state.bustTimer += dt;
      if (state.bustTimer > WANTED.bustTime) state.events.push({ type: 'busted' });
    }
  }
  if (wanted.stars < 2) state.entities.footCops.length = 0;
}
