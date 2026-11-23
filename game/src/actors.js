// The other people in Solmar: traffic that follows the road grid, parked cars
// to steal, pedestrians who stroll the sidewalks and run from gunfire, and the
// police — patrol cars that ram the player and foot cops who chase and bust.

import { CAR_TUNE, HEAT, WORLD_H, ROAD_W } from './config.js';
import { clamp, distSq, turnDiff } from './rng.js';

const PAINT = ['#c94f4f', '#4f7ec9', '#e0b13c', '#7a4fc9', '#4fc98a', '#d8d8d8', '#3a3a3a', '#e07840', '#5fb3c9'];
const CLOTHES = ['#e86a6a', '#6a9ae8', '#e8c96a', '#8ae86a', '#c96ad8', '#e8a06a', '#6ad8d0'];

export function makeVehicle(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color, kind: kind || 'traffic',
    len: CAR_TUNE.len, wid: CAR_TUNE.wid, hp: 100,
    along: Math.abs(Math.sin(angle)) > 0.7,
    dir: 1, cruise: 120 + Math.random() * 60, siren: 0,
  };
}

export function spawnCityLife(city, rng) {
  const traffic = [];
  const parked = [];
  const walkers = [];
  const patrol = [];
  for (let i = 0; i < 14; i += 1) {
    const p = city.randomRoadSpot();
    const angle = p.along ? (rng.maybe(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.maybe(0.5) ? 0 : Math.PI);
    const car = makeVehicle(p.x, p.y, angle, rng.from(PAINT), 'traffic');
    car.along = p.along;
    car.dir = rng.maybe(0.5) ? 1 : -1;
    car.cruise = rng.between(110, 190);
    car.speed = car.cruise;
    traffic.push(car);
  }
  for (let i = 0; i < 10; i += 1) {
    const p = city.randomRoadSpot();
    const angle = p.along ? Math.PI / 2 : 0;
    const off = rng.maybe(0.5) ? ROAD_W / 2 - 14 : -(ROAD_W / 2 - 14);
    parked.push(makeVehicle(
      p.x + (p.along ? off : 0), p.y + (p.along ? 0 : off),
      angle, rng.from(PAINT), 'parked',
    ));
  }
  for (let i = 0; i < 24; i += 1) {
    const p = city.randomWalkSpot();
    walkers.push({
      x: p.x, y: p.y, angle: rng.between(0, Math.PI * 2), speed: rng.between(28, 55),
      color: rng.from(CLOTHES), flee: 0, alive: true, bob: rng.between(0, 6),
      goalX: p.x, goalY: p.y, wait: rng.between(0, 4),
    });
  }
  return { traffic, parked, walkers, patrol, beat: [] };
}

// Is there a car right in front of this one, inside the gap?
function carInFront(list, car, gap) {
  for (const other of list) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = car.along ? dy * car.dir : dx * car.dir;
    const side = car.along ? Math.abs(dx) : Math.abs(dy);
    if (ahead > 0 && ahead < gap && side < 26) return true;
  }
  return false;
}

function respawnOnRoad(city, car) {
  const p = city.randomRoadSpot();
  car.x = p.x;
  car.y = p.y;
  car.along = p.along;
  car.angle = p.along ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  car.speed = car.cruise;
}

export function updateTraffic(state, dt) {
  const { city, actors } = state;
  const all = [...actors.traffic, ...actors.parked.filter((c) => c.kind === 'traffic')];
  for (const car of actors.traffic) {
    if (!city.onRoad(car.x, car.y)) {
      respawnOnRoad(city, car);
      continue;
    }
    const want = carInFront(all, car, 90) ? 0 : car.cruise;
    car.speed += clamp(want - car.speed, -260 * dt, 160 * dt);
    const step = car.speed * car.dir * dt;
    if (car.along) car.y += step;
    else car.x += step;
    if (car.x < 40 || car.x > 3440 || car.y < 40 || car.y > WORLD_H - 40) respawnOnRoad(city, car);
  }
}

export function updateWalkers(state, dt) {
  const { player } = state;
  for (const w of state.actors.walkers) {
    if (!w.alive) continue;
    w.bob += dt * 8;
    if (distSq(w.x, w.y, player.x, player.y) < 260 * 260) w.flee = 2.5;
    if (w.flee > 0) {
      w.flee -= dt;
      const away = Math.atan2(w.y - player.y, w.x - player.x);
      w.angle = away;
      w.x += Math.cos(away) * 120 * dt;
      w.y += Math.sin(away) * 120 * dt;
      continue;
    }
    if (w.wait > 0) {
      w.wait -= dt;
      continue;
    }
    const dx = w.goalX - w.x;
    const dy = w.goalY - w.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      const p = state.city.randomWalkSpot();
      w.goalX = p.x;
      w.goalY = p.y;
      w.wait = 1 + Math.random() * 4;
      continue;
    }
    w.angle = Math.atan2(dy, dx);
    w.x += (dx / d) * w.speed * dt;
    w.y += (dy / d) * w.speed * dt;
  }
}

export function callCops(state) {
  const { city, player } = state;
  let spot = city.randomRoadSpot();
  let tries = 0;
  while (tries < 8 && distSq(spot.x, spot.y, player.x, player.y) < 500 * 500) {
    spot = city.randomRoadSpot();
    tries += 1;
  }
  const cop = makeVehicle(spot.x, spot.y, Math.atan2(player.y - spot.y, player.x - spot.x), '#20242e', 'cop');
  cop.speed = 200;
  state.actors.patrol.push(cop);
}

export function updateCops(state, dt) {
  const { player, actors } = state;
  const stars = player.wanted.stars;
  const wantCount = HEAT.copHowMany[stars] || 0;
  if (actors.patrol.length < wantCount && Math.random() < dt * 0.8) callCops(state);
  if (actors.patrol.length > wantCount) actors.patrol.splice(wantCount);

  for (const cop of actors.patrol) {
    cop.siren += dt;
    const target = Math.atan2(player.y - cop.y, player.x - cop.x);
    const diff = turnDiff(cop.angle, target);
    cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const top = HEAT.copTopSpeed[stars] || 300;
    cop.speed = clamp(cop.speed + (top - cop.speed) * dt, 0, top);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!state.city.blockedForCar(nx, ny, CAR_TUNE.len / 2, CAR_TUNE.wid / 2, cop.angle)) {
      cop.x = nx;
      cop.y = ny;
    } else {
      cop.angle += 1.2 * dt;
      cop.speed *= 0.6;
    }
    // Ram: hurts a player on foot, shoves and damages a player car.
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
    // A cop car parked on a player on foot long enough ends the run.
    if (player.mode === 'foot' && d < HEAT.bustDist) {
      state.bustTimer += dt;
      if (state.bustTimer > HEAT.bustHold) state.events.push({ type: 'busted' });
    }
  }
  if (actors.patrol.length === 0) state.bustTimer = 0;

  // Beat cops join once the heat is serious and Mara is on foot.
  if (stars >= 2 && player.mode === 'foot') {
    if (state.actors.beat.length < stars - 1 && Math.random() < dt * 0.4) {
      const p = state.city.randomWalkSpot();
      state.actors.beat.push({ x: p.x, y: p.y, angle: 0, speed: 195, color: '#20242e' });
    }
  }
  for (const cop of state.actors.beat) {
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    const a = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.speed * dt;
    cop.y += Math.sin(a) * cop.speed * dt;
    if (d < HEAT.bustDist) {
      state.bustTimer += dt;
      if (state.bustTimer > HEAT.bustHold) state.events.push({ type: 'busted' });
    }
  }
  if (stars < 2) state.actors.beat.length = 0;
}
