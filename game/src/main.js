// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps,
// and the renderer paints what is there. Screens: title, play, paused, busted, win.
// ?seed=N fixes the city. ?shot=cover|street|mission|start (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createEntities, stepTraffic, stepPedestrians, stepPolice } from './entities.js';
import { createPlayer, stepPlayerFoot, stepPlayerCar, nearestCar, enterCar, exitCar, playerPunch, playerShoot, decayWanted } from './player.js';
import { createMissions, updateMissions, missionObjective } from './missions.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_PUNCH, ACTION_MUTE, ACTION_SAVE } from './input.js';
import { createRenderer } from './render.js';
import { readSave, writeSave, applySave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const HEALTH_REGEN = 2.5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261123;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);

window.addEventListener('error', (event) => {
  status.textContent = `Error: ${event.message}`;
});

function buildState() {
  const world = createWorld(seed);
  const entities = createEntities(world, createRandom(seed + 7));
  const missions = createMissions(world, createRandom(seed + 13));
  const player = createPlayer(world.landmarks.hideout.x, world.landmarks.hideout.y);
  const state = {
    world, entities, missions, player, audio,
    now: 0, messages: [], events: [], shot: null, bustTimer: 0,
    objectiveText: '', hasSave: !!readSave(),
  };
  state.stepWorld = function stepWorld(dt) {
    stepTraffic(state, dt);
    stepPedestrians(state, dt);
    stepPolice(state, dt);
    updateMissions(state, dt, state.now);
    decayWanted(player, state.now, dt);
    if (player.health < 100 && player.wanted.stars === 0) player.health = Math.min(100, player.health + HEALTH_REGEN * dt);
    if (state.shot) {
      state.shot.t -= dt;
      if (state.shot.t <= 0) state.shot = null;
    }
    for (const msg of state.messages) msg.life -= dt;
    state.messages = state.messages.filter((m) => m.life > 0);
    state.objectiveText = missionObjective(state);
    drainEvents(state);
  };
  state.stepFoot = function stepFoot(input, dt, now) {
    stepPlayerFoot(state, input, dt, now);
  };
  state.stepCar = function stepCar(input, dt) {
    stepPlayerCar(state, input, dt);
  };
  return state;
}

// Rebuild the world into the same state object, so the loop and the shot stager keep
// working on the object they already hold.
function resetState(state) {
  const fresh = buildState();
  const keepSave = state.hasSave;
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.messages = [];
  state.events = [];
  state.hasSave = keepSave;
}

function drainEvents(state) {
  for (const event of state.events) {
    if (event.type === 'message') {
      state.messages.push({ text: event.text, life: 6 });
      if (state.messages.length > 4) state.messages.shift();
    } else if (event.type === 'crash') {
      state.audio.crash();
    } else if (event.type === 'hit') {
      // Damage already applied; the vignette shows it.
    } else if (event.type === 'busted') {
      state.pendingBusted = true;
    } else if (event.type === 'win') {
      state.pendingWin = true;
    }
  }
  state.events.length = 0;
}

const state = buildState();

function runShot(name) {
  resetState(state);
  const scene = stageShot(name, state);
  renderer.snapCamera(state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      const car = state.player.car;
      status.textContent = `Shot ready: ${name} | player ${Math.round(state.player.x)},${Math.round(state.player.y)} mode=${state.player.mode} carSpeed=${car ? Math.round(car.speed) : '-'} carAngle=${car ? car.angle.toFixed(2) : '-'} carHp=${car ? Math.round(car.hp) : '-'} cops=${state.entities.cops.length} mission=${state.missions.index}.${state.missions.step} stars=${state.player.wanted.stars}`;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) {
      resetState(state);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Follow the gold marker — Eddie is waiting.');
  }

  function continueSave() {
    const save = readSave();
    resetState(state);
    if (save) applySave(state, save);
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Welcome back to Solmar.');
  }

  function bustPlayer() {
    const lost = Math.floor(state.player.cash * 0.25);
    state.player.cash -= lost;
    state.player.health = 100;
    state.player.wanted.stars = 0;
    state.player.wanted.heat = 0;
    state.entities.cops.length = 0;
    state.entities.footCops.length = 0;
    state.bustTimer = 0;
    if (state.player.mode === 'car') exitCar(state);
    state.player.x = state.world.landmarks.hospital.x;
    state.player.y = state.world.landmarks.hospital.y;
    screen = SCREEN_OVER;
    announce(`Busted. You lost $${lost} in fines.`);
  }

  function handleActions() {
    const { actions, clicked } = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      state.messages.push({ text: muted ? 'Sound off' : 'Sound on', life: 2 });
    }
    if (actions & ACTION_SAVE && screen === SCREEN_PLAY) {
      const ok = writeSave(state);
      state.messages.push({ text: ok ? 'Game saved.' : 'Save failed — storage is off.', life: 3 });
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) {
        if (state.hasSave) continueSave();
        else startGame(false);
      } else if (screen === SCREEN_OVER) {
        startGame(false);
        screen = SCREEN_PLAY;
      } else if (screen === SCREEN_WIN) {
        screen = SCREEN_PLAY;
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER_CAR) {
      if (state.player.mode === 'foot') {
        const car = nearestCar(state, 70);
        if (car) enterCar(state, car, state.now);
      } else {
        exitCar(state);
      }
    }
    if (actions & ACTION_PUNCH) playerPunch(state, state.now);
    if (clicked && state.player.mode === 'foot') {
      const target = renderer.screenToWorld(input.mouse.x, input.mouse.y);
      playerShoot(state, target, state.now);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      state.now += STEP;
      state.stepWorld(STEP);
      return;
    }
    if (state.player.mode === 'car') state.stepCar(input, STEP);
    else state.stepFoot(input, STEP, state.now);
    state.now += STEP;
    state.stepWorld(STEP);
    if (state.pendingBusted) {
      state.pendingBusted = false;
      bustPlayer();
    } else if (state.pendingWin) {
      state.pendingWin = false;
      screen = SCREEN_WIN;
    } else if (state.player.health <= 0) {
      bustPlayer();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });

  announce('SOLMAR. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
