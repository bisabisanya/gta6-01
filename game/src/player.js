// The player: Mara Reyes, on foot and behind the wheel. Foot movement with run, arcade car
// physics (accelerate, steer, handbrake drift), stealing cars, punching and shooting, and the
// wanted heat that crimes build and clean time cools.
import { PLAYER, CAR, WANTED } from './config.js';
import { clamp, dist2, angleDiff } from './random.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, mode: 'foot', car: null,
    health: PLAYER.health, ammo: PLAYER.ammoStart,
    punchTimer: 0, shootTimer: 0, punchAnim: 0, muzzle: 0,
    wanted: { stars: 0, heat: 0, lastCrime: -999 },
    cash: 250, missionsDone: 0, faresDone: 0, pickups: 0,
    speed: 0,
  };
}

export function addHeat(player, stars, now) {
  player.wanted.stars = clamp(player.wanted.stars + stars, 0, WANTED.max);
  player.wanted.heat = 100;
  player.wanted.lastCrime = now;
}

export function decayWanted(player, now, dt) {
  if (player.wanted.stars === 0) return;
  if (now - player.wanted.lastCrime > WANTED.decayDelay) {
    player.wanted.heat -= WANTED.decayPerSecond * 100 * dt;
    if (player.wanted.heat <= 0) {
      player.wanted.stars -= 1;
      player.wanted.heat = player.wanted.stars > 0 ? 100 : 0;
    }
  }
}

export function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  const all = [...state.entities.parked, ...state.entities.traffic];
  for (const car of all) {
    const d = dist2(state.player.x, state.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(state, car, now) {
  const { player } = state;
  player.mode = 'car';
  player.car = car;
  car.kind = 'player';
  const i = state.entities.parked.indexOf(car);
  if (i >= 0) state.entities.parked.splice(i, 1);
  const j = state.entities.traffic.indexOf(car);
  if (j >= 0) state.entities.traffic.splice(j, 1);
  // Stealing a car that is not yours is a crime, unless it was already yours.
  if (car.stolen !== true && car.owned !== true) {
    car.stolen = true;
    addHeat(player, WANTED.stealCar, now);
    state.events.push({ type: 'message', text: 'Car stolen! The cops noticed.' });
  }
  state.audio.engine(0);
}

export function exitCar(state) {
  const { player, world } = state;
  const car = player.car;
  if (!car) return;
  const bx = car.x - Math.cos(car.angle) * 40;
  const by = car.y - Math.sin(car.angle) * 40;
  player.x = world.collides(bx, by, PLAYER.radius) ? car.x + Math.cos(car.angle) * 40 : bx;
  player.y = world.collides(bx, by, PLAYER.radius) ? car.y + Math.sin(car.angle) * 40 : by;
  player.angle = car.angle;
  player.mode = 'foot';
  player.car = null;
  car.kind = 'parked';
  car.owned = true;
  state.entities.parked.push(car);
}

export function stepPlayerFoot(state, input, dt, now) {
  const { player, world } = state;
  const move = input.moveVector();
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (move.x !== 0 || move.y !== 0) {
    player.angle = Math.atan2(move.y, move.x);
    const nx = player.x + move.x * speed * dt;
    const ny = player.y + move.y * speed * dt;
    if (!world.collides(nx, player.y, PLAYER.radius)) player.x = nx;
    if (!world.collides(player.x, ny, PLAYER.radius)) player.y = ny;
  }
  player.speed = (move.x !== 0 || move.y !== 0) ? speed : 0;
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.shootTimer = Math.max(0, player.shootTimer - dt);
  player.punchAnim = Math.max(0, player.punchAnim - dt);
  player.muzzle = Math.max(0, player.muzzle - dt);
}

export function stepPlayerCar(state, input, dt) {
  const { player, world } = state;
  const car = player.car;
  if (!car) return;
  const drive = input.drive();
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  const velAlong = car.speed;
  const accel = drive.throttle ? CAR.accel : drive.brake ? -CAR.brake : 0;
  car.speed += accel * dt;
  if (drive.brake && car.speed < 5 && car.speed > -CAR.maxReverse) car.speed -= CAR.reverseAccel * dt;
  if (!drive.throttle && !drive.brake) car.speed -= car.speed * CAR.drag * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerInput = drive.steer * (car.speed >= 0 ? 1 : -1);
  const steerAmount = CAR.steer * clamp(Math.abs(car.speed) / 200, 0, 1) * (drive.handbrake ? 1.5 : 1);
  car.angle += steerInput * steerAmount * dt * (drive.handbrake ? 1.4 : 1);
  if (drive.handbrake) car.speed *= 1 - 1.4 * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!world.collidesCar(nx, ny, CAR.length / 2, CAR.width / 2, car.angle)) {
    car.x = nx;
    car.y = ny;
  } else {
    if (Math.abs(car.speed) > 240) {
      state.events.push({ type: 'crash' });
      car.hp -= 8;
    }
    car.speed *= -0.25;
  }
  // Shove traffic cars and pedestrians out of the way (and hurt peds — a crime).
  for (const other of state.entities.traffic) {
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 52 && d > 0.01) {
      other.x += ((other.x - car.x) / d) * 60 * dt * 10;
      other.y += ((other.y - car.y) / d) * 60 * dt * 10;
      other.speed *= 0.5;
      if (Math.abs(car.speed) > 200) state.events.push({ type: 'crash' });
    }
  }
  for (const ped of state.entities.peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 34 && Math.abs(car.speed) > 60) {
      ped.alive = false;
      addHeat(player, WANTED.punchPed, state.now);
      state.events.push({ type: 'message', text: 'You hit a pedestrian! Wanted level up.' });
    }
  }
  player.x = car.x;
  player.y = car.y;
  player.speed = Math.abs(car.speed);
  if (Math.abs(car.speed) > 40 && Math.random() < dt * 8) state.audio.engine(Math.abs(car.speed) / CAR.maxSpeed);
  if (car.hp <= 0) {
    state.events.push({ type: 'message', text: 'Your car is wrecked!' });
    exitCar(state);
  }
}

export function playerPunch(state, now) {
  const { player } = state;
  if (player.punchTimer > 0 || player.mode !== 'foot') return;
  player.punchTimer = PLAYER.punchCooldown;
  player.punchAnim = 0.22;
  state.audio.punch();
  const reach = PLAYER.punchRange + PLAYER.radius;
  for (const ped of state.entities.peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (d < reach) {
      ped.alive = false;
      addHeat(player, WANTED.punchPed, now);
      state.events.push({ type: 'message', text: 'You knocked someone out! Wanted level up.' });
      return;
    }
  }
  for (const cop of state.entities.footCops) {
    const d = Math.hypot(cop.x - player.x, cop.y - player.y);
    if (d < reach) {
      state.entities.footCops.splice(state.entities.footCops.indexOf(cop), 1);
      addHeat(player, WANTED.killCop, now);
      state.events.push({ type: 'message', text: 'You dropped a cop! Heat way up.' });
      return;
    }
  }
}

export function playerShoot(state, mouseWorld, now) {
  const { player } = state;
  if (player.shootTimer > 0 || player.mode !== 'foot' || player.ammo <= 0) return;
  player.shootTimer = PLAYER.pistolCooldown;
  player.ammo -= 1;
  player.muzzle = 0.08;
  player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
  state.audio.shoot();
  addHeat(player, WANTED.shoot, now);
  const aim = player.angle;
  let best = null;
  let bestD = PLAYER.pistolRange;
  const targets = [
    ...state.entities.peds.filter((p) => p.alive).map((p) => ({ x: p.x, y: p.y, kind: 'ped', ref: p })),
    ...state.entities.footCops.map((c) => ({ x: c.x, y: c.y, kind: 'cop', ref: c })),
    ...state.entities.cops.map((c) => ({ x: c.x, y: c.y, kind: 'copcar', ref: c })),
  ];
  for (const t of targets) {
    const d = Math.hypot(t.x - player.x, t.y - player.y);
    if (d > bestD) continue;
    const diff = Math.abs(angleDiff(aim, Math.atan2(t.y - player.y, t.x - player.x)));
    if (diff < 0.16 && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  state.shot = { x1: player.x, y1: player.y, x2: player.x + Math.cos(aim) * Math.max(bestD, 60), y2: player.y + Math.sin(aim) * Math.max(bestD, 60), t: 0.09 };
  if (!best) return;
  if (best.kind === 'ped') {
    best.ref.alive = false;
    state.events.push({ type: 'message', text: 'Pedestrian down. The city saw that.' });
  } else if (best.kind === 'cop') {
    state.entities.footCops.splice(state.entities.footCops.indexOf(best.ref), 1);
    addHeat(player, WANTED.killCop, now);
    state.events.push({ type: 'message', text: 'Cop down! Wanted level up.' });
  } else {
    best.ref.hp -= PLAYER.pistolDamage;
    if (best.ref.hp <= 0) {
      state.entities.cops.splice(state.entities.cops.indexOf(best.ref), 1);
      state.events.push({ type: 'message', text: 'Police car disabled!' });
    }
  }
}
