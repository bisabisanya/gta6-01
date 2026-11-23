// Screenshot scenes behind ?shot=cover|street|mission|start. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a small autopilot (drive
// toward the marker, steer away from buildings, keep the chase in frame), so every frame is
// what real play looks like and the same seed always gives the same frame.
import { STEP, ROADS_X, ROADS_Y, ROAD_WIDTH } from './config.js';
import { enterCar, addHeat } from './player.js';
import { spawnCop } from './entities.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './config.js';

const SAMPLE = 1 / 30;

function nearestLine(value, lines) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

// Manhattan autopilot: drive along the road grid toward the marker (one turn at most),
// so the car never tries to cut diagonally through a block of buildings.
function autopilotDrive(state) {
  const { player, world } = state;
  const car = player.car;
  if (!car) return { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const marker = state.missions.marker;
  const tx = marker ? marker.x : world.landmarks.garage.x;
  const ty = marker ? marker.y : world.landmarks.garage.y;
  const rx = nearestLine(car.x, ROADS_X);
  const ry = nearestLine(car.y, ROADS_Y);
  const onVertical = Math.abs(car.x - rx) < ROAD_WIDTH / 2 - 14;
  const onHorizontal = Math.abs(car.y - ry) < ROAD_WIDTH / 2 - 14;
  let wx;
  let wy;
  // Aim at the corner first when close to it, so the turn starts early and tight.
  if (onVertical && Math.abs(ty - car.y) > 260) {
    wx = rx;
    wy = ty;
  } else if (onVertical && Math.hypot(rx - car.x, ry - car.y) > 40) {
    wx = rx;
    wy = ry;
  } else if (onVertical) {
    wx = tx;
    wy = ry;
  } else if (onHorizontal && Math.abs(tx - car.x) > 260) {
    wx = tx;
    wy = ry;
  } else if (onHorizontal && Math.hypot(rx - car.x, ry - car.y) > 40) {
    wx = rx;
    wy = ry;
  } else if (onHorizontal) {
    wx = rx;
    wy = ty;
  } else {
    const p = world.nearestRoadPoint(car.x, car.y);
    wx = p.x;
    wy = p.y;
  }
  const wantAngle = Math.atan2(wy - car.y, wx - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  let steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  // Brake into a sharp turn so the turning circle stays on the road; the handbrake
  // tightens the turn further, keeping the car off the corner lots.
  const sharpTurn = Math.abs(diff) > 0.5;
  const brake = sharpTurn && Math.abs(car.speed) > 200 ? 1 : 0;
  const handbrake = sharpTurn && Math.abs(car.speed) > 120 ? 1 : 0;
  // If a building sits straight ahead, swing the same way the target lies.
  const aheadX = car.x + Math.cos(car.angle) * 110;
  const aheadY = car.y + Math.sin(car.angle) * 110;
  if (world.collides(aheadX, aheadY, 10)) steer = diff >= 0 ? 1 : -1;
  return { throttle: brake ? 0 : 1, brake, steer, handbrake };
}

function autopilotWalk(state) {
  const { player } = state;
  const marker = state.missions.marker;
  if (!marker) return { x: 0, y: 0 };
  const dx = marker.x - player.x;
  const dy = marker.y - player.y;
  const d = Math.hypot(dx, dy);
  if (d < 10) return { x: 0, y: 0 };
  return { x: dx / d, y: dy / d };
}

function stepWorld(state, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    state.now += STEP;
    const input = drive ? autopilotDrive(state) : autopilotWalk(state);
    if (state.player.mode === 'car') {
      state.stepCar({ drive: () => input, moveVector: () => ({ x: 0, y: 0 }), running: () => false }, STEP);
    } else {
      state.stepFoot({ moveVector: () => input, drive: () => ({ throttle: 0, brake: 0, steer: 0, handbrake: 0 }), running: () => false }, STEP, state.now);
    }
    state.stepWorld(STEP);
  }
}

export function stageShot(name, state) {
  const { world, player } = state;
  if (name === 'start') {
    // Title over a busy downtown corner: camera on the hotel, traffic rolling.
    player.x = 2700;
    player.y = 1300;
    for (let i = 0; i < 5 / STEP; i += 1) {
      state.now += STEP;
      state.stepWorld(STEP);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'street') {
    // On foot on the beach road: palms, ocean, traffic, pedestrians, one star.
    player.x = 3300;
    player.y = 1300;
    addHeat(player, 1, 0);
    for (let i = 0; i < 8 / STEP; i += 1) {
      state.now += STEP;
      state.stepWorld(STEP);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    // Mission 4: on foot in the park, grabbing a cash bag, cops closing in.
    state.missions.index = 3;
    state.missions.step = 0;
    player.x = world.landmarks.park.x - 160;
    player.y = world.landmarks.park.y + 120;
    addHeat(player, 2, 0);
    stepWorld(state, 2, false);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // Cover (default): driving the getaway — three stars, cop cars on the tail,
  // mission marker ahead, downtown towers all around. Mission 3 (Heat Wave) sends
  // the car south down road 2700, then west along road 2300 to the hideout.
  const car = state.entities.parked[0];
  enterCar(state, car, 0);
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
  spawnCop(state);
  spawnCop(state);
  stepWorld(state, 5, true);
  return { screen: SCREEN_PLAY, best: 0 };
}

export { SAMPLE };
