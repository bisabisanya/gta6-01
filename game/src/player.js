// Mara Reyes, on foot and behind the wheel. Foot movement with a run, arcade
// car physics (throttle, steering, handbrake drift), stealing cars, punching
// and shooting, and the wanted heat that crimes build and clean time cools.

import { ON_FOOT, CAR_TUNE, HEAT } from './config.js';
import { clamp, distSq, turnDiff } from './rng.js';

export function newPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, mode: 'foot', car: null,
    health: ON_FOOT.health, ammo: ON_FOOT.ammo0,
    punchWait: 0, shotWait: 0, punchAnim: 0, muzzle: 0,
    wanted: { stars: 0, heat: 0, lastCrime: -999 },
    cash: 250, missionsDone: 0, faresDone: 0, pickups: 0,
    speed: 0,
  };
}

export function raiseHeat(player, stars, now) {
  player.wanted.stars = clamp(player.wanted.stars + stars, 0, HEAT.top);
  player.wanted.heat = 100;
  player.wanted.lastCrime = now;
}

export function coolHeat(player, now, dt) {
  if (player.wanted.stars === 0) return;
  if (now - player.wanted.lastCrime > HEAT.coolAfter) {
    player.wanted.heat -= HEAT.coolRate * 100 * dt;
    if (player.wanted.heat <= 0) {
      player.wanted.stars -= 1;
      player.wanted.heat = player.wanted.stars > 0 ? 100 : 0;
    }
  }
}

export function closestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  const all = [...state.actors.parked, ...state.actors.traffic];
  for (const car of all) {
    const d = distSq(state.player.x, state.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function takeCar(state, car, now) {
  const { player } = state;
  player.mode = 'car';
  player.car = car;
  car.kind = 'player';
  const i = state.actors.parked.indexOf(car);
  if (i >= 0) state.actors.parked.splice(i, 1);
  const j = state.actors.traffic.indexOf(car);
  if (j >= 0) state.actors.traffic.splice(j, 1);
  // Taking a car that is not already hers is a crime.
  if (car.stolen !== true && car.owned !== true) {
    car.stolen = true;
    raiseHeat(player, HEAT.forSteal, now);
    state.events.push({ type: 'message', text: 'Car stolen! The cops noticed.' });
  }
  state.audio.engine(0);
}

export function leaveCar(state) {
  const { player, city } = state;
  const car = player.car;
  if (!car) return;
  const bx = car.x - Math.cos(car.angle) * 40;
  const by = car.y - Math.sin(car.angle) * 40;
  player.x = city.blocked(bx, by, ON_FOOT.radius) ? car.x + Math.cos(car.angle) * 40 : bx;
  player.y = city.blocked(bx, by, ON_FOOT.radius) ? car.y + Math.sin(car.angle) * 40 : by;
  player.angle = car.angle;
  player.mode = 'foot';
  player.car = null;
  car.kind = 'parked';
  car.owned = true;
  state.actors.parked.push(car);
}

export function walkPlayer(state, input, dt) {
  const { player, city } = state;
  const move = input.moveVector();
  const speed = input.running() ? ON_FOOT.run : ON_FOOT.walk;
  if (move.x !== 0 || move.y !== 0) {
    player.angle = Math.atan2(move.y, move.x);
    const nx = player.x + move.x * speed * dt;
    const ny = player.y + move.y * speed * dt;
    if (!city.blocked(nx, player.y, ON_FOOT.radius)) player.x = nx;
    if (!city.blocked(player.x, ny, ON_FOOT.radius)) player.y = ny;
  }
  player.speed = (move.x !== 0 || move.y !== 0) ? speed : 0;
  player.punchWait = Math.max(0, player.punchWait - dt);
  player.shotWait = Math.max(0, player.shotWait - dt);
  player.punchAnim = Math.max(0, player.punchAnim - dt);
  player.muzzle = Math.max(0, player.muzzle - dt);
}

export function drivePlayer(state, input, dt) {
  const { player, city } = state;
  const car = player.car;
  if (!car) return;
  const drive = input.drive();
  const accel = drive.throttle ? CAR_TUNE.accel : drive.brake ? -CAR_TUNE.brake : 0;
  car.speed += accel * dt;
  if (drive.brake && car.speed < 5 && car.speed > -CAR_TUNE.topBack) car.speed -= CAR_TUNE.backAccel * dt;
  if (!drive.throttle && !drive.brake) car.speed -= car.speed * CAR_TUNE.drag * dt;
  car.speed = clamp(car.speed, -CAR_TUNE.topBack, CAR_TUNE.topSpeed);
  const steerDir = drive.steer * (car.speed >= 0 ? 1 : -1);
  const steerAmt = CAR_TUNE.steer * clamp(Math.abs(car.speed) / 200, 0, 1) * (drive.handbrake ? 1.5 : 1);
  car.angle += steerDir * steerAmt * dt * (drive.handbrake ? 1.4 : 1);
  if (drive.handbrake) car.speed *= 1 - 1.4 * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!city.blockedForCar(nx, ny, CAR_TUNE.len / 2, CAR_TUNE.wid / 2, car.angle)) {
    car.x = nx;
    car.y = ny;
  } else {
    if (Math.abs(car.speed) > 240) {
      state.events.push({ type: 'crash' });
      car.hp -= 8;
    }
    car.speed *= -0.25;
  }
  // Shove traffic aside; hitting a pedestrian is a crime.
  for (const other of state.actors.traffic) {
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 52 && d > 0.01) {
      other.x += ((other.x - car.x) / d) * 60 * dt * 10;
      other.y += ((other.y - car.y) / d) * 60 * dt * 10;
      other.speed *= 0.5;
      if (Math.abs(car.speed) > 200) state.events.push({ type: 'crash' });
    }
  }
  for (const ped of state.actors.walkers) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 34 && Math.abs(car.speed) > 60) {
      ped.alive = false;
      raiseHeat(player, HEAT.forAssault, state.now);
      state.events.push({ type: 'message', text: 'You hit a pedestrian! Wanted level up.' });
    }
  }
  player.x = car.x;
  player.y = car.y;
  player.speed = Math.abs(car.speed);
  if (Math.abs(car.speed) > 40 && Math.random() < dt * 8) state.audio.engine(Math.abs(car.speed) / CAR_TUNE.topSpeed);
  if (car.hp <= 0) {
    state.events.push({ type: 'message', text: 'Your car is wrecked!' });
    leaveCar(state);
  }
}

export function throwPunch(state, now) {
  const { player } = state;
  if (player.punchWait > 0 || player.mode !== 'foot') return;
  player.punchWait = ON_FOOT.punchWait;
  player.punchAnim = 0.22;
  state.audio.punch();
  const reach = ON_FOOT.punchReach + ON_FOOT.radius;
  for (const ped of state.actors.walkers) {
    if (!ped.alive) continue;
    if (Math.hypot(ped.x - player.x, ped.y - player.y) < reach) {
      ped.alive = false;
      raiseHeat(player, HEAT.forAssault, now);
      state.events.push({ type: 'message', text: 'You knocked someone out! Wanted level up.' });
      return;
    }
  }
  for (const cop of state.actors.beat) {
    if (Math.hypot(cop.x - player.x, cop.y - player.y) < reach) {
      state.actors.beat.splice(state.actors.beat.indexOf(cop), 1);
      raiseHeat(player, HEAT.forCopDown, now);
      state.events.push({ type: 'message', text: 'You dropped a cop! Heat way up.' });
      return;
    }
  }
}

export function firePistol(state, mouseWorld, now) {
  const { player } = state;
  if (player.shotWait > 0 || player.mode !== 'foot' || player.ammo <= 0) return;
  player.shotWait = ON_FOOT.shotWait;
  player.ammo -= 1;
  player.muzzle = 0.08;
  player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
  state.audio.shoot();
  raiseHeat(player, HEAT.forShot, now);
  const aim = player.angle;
  let best = null;
  let bestD = ON_FOOT.shotReach;
  const targets = [
    ...state.actors.walkers.filter((p) => p.alive).map((p) => ({ x: p.x, y: p.y, kind: 'ped', ref: p })),
    ...state.actors.beat.map((c) => ({ x: c.x, y: c.y, kind: 'cop', ref: c })),
    ...state.actors.patrol.map((c) => ({ x: c.x, y: c.y, kind: 'copcar', ref: c })),
  ];
  for (const t of targets) {
    const d = Math.hypot(t.x - player.x, t.y - player.y);
    if (d > bestD) continue;
    const off = Math.abs(turnDiff(aim, Math.atan2(t.y - player.y, t.x - player.x)));
    if (off < 0.16 && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  state.shot = {
    x1: player.x, y1: player.y,
    x2: player.x + Math.cos(aim) * Math.max(bestD, 60),
    y2: player.y + Math.sin(aim) * Math.max(bestD, 60),
    t: 0.09,
  };
  if (!best) return;
  if (best.kind === 'ped') {
    best.ref.alive = false;
    state.events.push({ type: 'message', text: 'Pedestrian down. The city saw that.' });
  } else if (best.kind === 'cop') {
    state.actors.beat.splice(state.actors.beat.indexOf(best.ref), 1);
    raiseHeat(player, HEAT.forCopDown, now);
    state.events.push({ type: 'message', text: 'Cop down! Wanted level up.' });
  } else {
    best.ref.hp -= ON_FOOT.shotHurt;
    if (best.ref.hp <= 0) {
      state.actors.patrol.splice(state.actors.patrol.indexOf(best.ref), 1);
      state.events.push({ type: 'message', text: 'Police car disabled!' });
    }
  }
}
