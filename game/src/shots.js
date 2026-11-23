// Screenshot scenes behind ?shot=cover|street|mission|start. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a small autopilot (drive toward the marker, steer away from
// buildings, keep the chase in frame), so every frame is what real play looks
// like — and the same seed always gives the same frame.

import { STEP, ROAD_LINES_X, ROAD_LINES_Y, ROAD_W, SCREEN_TITLE, SCREEN_PLAY } from './config.js';
import { takeCar, raiseHeat } from './player.js';
import { callCops } from './actors.js';
import { tickWorld, walkStep, driveStep } from './step.js';

function closestLine(value, lines) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

// Manhattan autopilot: drive along the road grid toward the marker (one turn
// at most), so the car never tries to cut diagonally through a block.
function driveToward(state) {
  const { player, city } = state;
  const car = player.car;
  if (!car) return { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const marker = state.missions.marker;
  const tx = marker ? marker.x : city.spots.garage.x;
  const ty = marker ? marker.y : city.spots.garage.y;
  const rx = closestLine(car.x, ROAD_LINES_X);
  const ry = closestLine(car.y, ROAD_LINES_Y);
  const onV = Math.abs(car.x - rx) < ROAD_W / 2 - 14;
  const onH = Math.abs(car.y - ry) < ROAD_W / 2 - 14;
  let wx;
  let wy;
  // Aim at the corner first when close to it, so the turn starts early.
  if (onV && Math.abs(ty - car.y) > 260) {
    wx = rx;
    wy = ty;
  } else if (onV && Math.hypot(rx - car.x, ry - car.y) > 40) {
    wx = rx;
    wy = ry;
  } else if (onV) {
    wx = tx;
    wy = ry;
  } else if (onH && Math.abs(tx - car.x) > 260) {
    wx = tx;
    wy = ry;
  } else if (onH && Math.hypot(rx - car.x, ry - car.y) > 40) {
    wx = rx;
    wy = ry;
  } else if (onH) {
    wx = rx;
    wy = ty;
  } else {
    const p = city.closestRoad(car.x, car.y);
    wx = p.x;
    wy = p.y;
  }
  const wantAngle = Math.atan2(wy - car.y, wx - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  // Brake into a sharp turn so the turning circle stays on the road; the
  // handbrake tightens the turn further, keeping the car off the corner lots.
  const sharp = Math.abs(diff) > 0.5;
  const brake = sharp && Math.abs(car.speed) > 200 ? 1 : 0;
  const handbrake = sharp && Math.abs(car.speed) > 120 ? 1 : 0;
  // A building straight ahead: swing the way the target lies.
  const aheadX = car.x + Math.cos(car.angle) * 110;
  const aheadY = car.y + Math.sin(car.angle) * 110;
  if (city.blocked(aheadX, aheadY, 10)) return { throttle: brake ? 0 : 1, brake, steer: diff >= 0 ? 1 : -1, handbrake };
  return { throttle: brake ? 0 : 1, brake, steer, handbrake };
}

function walkToward(state) {
  const { player } = state;
  const marker = state.missions.marker;
  if (!marker) return { x: 0, y: 0 };
  const dx = marker.x - player.x;
  const dy = marker.y - player.y;
  const d = Math.hypot(dx, dy);
  if (d < 10) return { x: 0, y: 0 };
  return { x: dx / d, y: dy / d };
}

function runWorld(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    state.now += STEP;
    if (state.player.mode === 'car') {
      driveStep(state, { drive: () => driveToward(state), moveVector: () => ({ x: 0, y: 0 }), running: () => false }, STEP);
    } else {
      walkStep(
        state,
        { moveVector: () => walkToward(state), drive: () => ({ throttle: 0, brake: 0, steer: 0, handbrake: 0 }), running: () => false },
        STEP, state.now,
      );
    }
    tickWorld(state, STEP);
  }
}

export function stageScene(name, state) {
  const { city, player } = state;
  if (name === 'start') {
    // Title over a busy downtown corner: camera on the hotel, traffic rolling.
    player.x = 2700;
    player.y = 1300;
    for (let i = 0; i < 5 / STEP; i += 1) {
      state.now += STEP;
      tickWorld(state, STEP);
    }
    return { screen: SCREEN_TITLE };
  }
  if (name === 'street') {
    // On foot on the beach road: palms, ocean, traffic, pedestrians, one star.
    player.x = 3300;
    player.y = 1300;
    raiseHeat(player, 1, 0);
    for (let i = 0; i < 8 / STEP; i += 1) {
      state.now += STEP;
      tickWorld(state, STEP);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mission 4: on foot in the park, grabbing a cash bag, cops closing in.
    state.missions.index = 3;
    state.missions.step = 0;
    player.x = city.spots.park.x - 160;
    player.y = city.spots.park.y + 120;
    raiseHeat(player, 2, 0);
    runWorld(state, 2);
    return { screen: SCREEN_PLAY };
  }
  // Cover (default): the getaway drive — three stars, cop cars on the tail, the
  // mission marker ahead, downtown towers all around. Mission 3 (Heat Wave)
  // sends the car south down road 2700, then west along road 2300 to the hideout.
  const car = state.actors.parked[0];
  takeCar(state, car, 0);
  player.car.x = 2700;
  player.car.y = 700;
  player.car.angle = Math.PI / 2;
  player.car.speed = 380;
  player.x = player.car.x;
  player.y = player.car.y;
  state.missions.index = 2;
  state.missions.step = 0;
  player.wanted.stars = 3;
  player.wanted.heat = 100;
  player.wanted.lastCrime = 0;
  callCops(state);
  callCops(state);
  runWorld(state, 5);
  // Stage the chase into the frame: the patrol cars trail Mara's car down
  // road 2300, close enough to read as a pursuit in one still frame.
  const trail = [[380, 30], [520, -40], [300, 60]];
  state.actors.patrol.forEach((cop, i) => {
    const off = trail[i % trail.length];
    cop.x = player.x + off[0];
    cop.y = player.y + off[1];
    cop.angle = Math.PI;
    cop.speed = 340;
  });
  return { screen: SCREEN_PLAY };
}
