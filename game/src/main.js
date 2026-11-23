// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title,
// play, paused, busted, win.
// ?seed=N fixes the city. ?shot=cover|street|mission|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_BUSTED, SCREEN_WON } from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './world.js';
import { spawnCityLife } from './actors.js';
import {
  newPlayer, closestCar, takeCar, leaveCar, throwPunch, firePistol,
} from './player.js';
import { newMissions } from './missions.js';
import { makeAudio } from './audio.js';
import { makeInput, ACT_CONFIRM, ACT_PAUSE, ACT_CAR, ACT_PUNCH, ACT_MUTE, ACT_SAVE } from './input.js';
import { makeRenderer } from './render.js';
import { loadSave, storeSave, restoreSave } from './save.js';
import { stageScene } from './shots.js';
import { tickWorld, walkStep, driveStep } from './step.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261123;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = makeAudio();
const renderer = makeRenderer(canvas);

window.addEventListener('error', (event) => {
  status.textContent = `Error: ${event.message}`;
});

function freshState() {
  const city = buildCity(seed);
  const actors = spawnCityLife(city, makeRng(seed + 7));
  const missions = newMissions(city);
  const player = newPlayer(city.spots.hideout.x, city.spots.hideout.y);
  return {
    city, actors, missions, player, audio,
    now: 0, messages: [], events: [], shot: null, bustTimer: 0,
    objectiveText: '', hasSave: !!loadSave(),
  };
}

// Rebuild the world into the same state object, so the loop and the shot
// stager keep working on the object they already hold.
function resetToFresh(state) {
  const fresh = freshState();
  const keepSave = state.hasSave;
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.messages = [];
  state.events = [];
  state.hasSave = keepSave;
}

const state = freshState();

function captureShot(name) {
  resetToFresh(state);
  const scene = stageScene(name, state);
  renderer.jumpCamera(state);
  let painted = 0;
  function paint() {
    renderer.paint(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      const car = state.player.car;
      status.textContent = `Shot ready: ${name} | player ${Math.round(state.player.x)},${Math.round(state.player.y)} mode=${state.player.mode} carSpeed=${car ? Math.round(car.speed) : '-'} carAngle=${car ? car.angle.toFixed(2) : '-'} carHp=${car ? Math.round(car.hp) : '-'} cops=${state.actors.patrol.length} mission=${state.missions.index}.${state.missions.step} stars=${state.player.wanted.stars}`;
    }
  }
  requestAnimationFrame(paint);
}

function playGame() {
  const input = makeInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) resetToFresh(state);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Follow the gold marker — Eddie is waiting.');
  }

  function continueSave() {
    const save = loadSave();
    resetToFresh(state);
    if (save) restoreSave(state, save);
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
    state.actors.patrol.length = 0;
    state.actors.beat.length = 0;
    state.bustTimer = 0;
    if (state.player.mode === 'car') leaveCar(state);
    state.player.x = state.city.spots.hospital.x;
    state.player.y = state.city.spots.hospital.y;
    screen = SCREEN_BUSTED;
    announce(`Busted. You lost $${lost} in fines.`);
  }

  function handleActions() {
    const { actions, clicked } = input.takeActions();
    if (actions & ACT_MUTE) {
      const muted = audio.toggleMute();
      state.messages.push({ text: muted ? 'Sound off' : 'Sound on', life: 2 });
    }
    if (actions & ACT_SAVE && screen === SCREEN_PLAY) {
      const ok = storeSave(state);
      state.messages.push({ text: ok ? 'Game saved.' : 'Save failed — storage is off.', life: 3 });
    }
    if (actions & ACT_CONFIRM) {
      if (screen === SCREEN_TITLE) {
        if (state.hasSave) continueSave();
        else startGame(false);
      } else if (screen === SCREEN_BUSTED) {
        startGame(false);
        screen = SCREEN_PLAY;
      } else if (screen === SCREEN_WON) {
        screen = SCREEN_PLAY;
      } else if (screen === SCREEN_PAUSE) {
        screen = SCREEN_PLAY;
      }
    }
    if (actions & ACT_PAUSE) {
      if (screen === SCREEN_PLAY) screen = SCREEN_PAUSE;
      else if (screen === SCREEN_PAUSE) screen = SCREEN_PLAY;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACT_CAR) {
      if (state.player.mode === 'foot') {
        const car = closestCar(state, 70);
        if (car) takeCar(state, car, state.now);
      } else {
        leaveCar(state);
      }
    }
    if (actions & ACT_PUNCH) throwPunch(state, state.now);
    if (clicked && state.player.mode === 'foot') {
      const target = renderer.toWorld(input.mouse.x, input.mouse.y);
      firePistol(state, target, state.now);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      state.now += STEP;
      tickWorld(state, STEP);
      return;
    }
    if (state.player.mode === 'car') driveStep(state, input, STEP);
    else walkStep(state, input, STEP, state.now);
    state.now += STEP;
    tickWorld(state, STEP);
    if (state.pendingBusted) {
      state.pendingBusted = false;
      bustPlayer();
    } else if (state.pendingWin) {
      state.pendingWin = false;
      screen = SCREEN_WON;
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
    renderer.paint(state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSE;
  });

  announce('SOLMAR. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) captureShot(shot);
else playGame();
