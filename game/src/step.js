// The world's heartbeat, as plain functions over a state object. They take the
// state they step as an argument on purpose: a state rebuilt into a new object
// (freshState / resetToFresh in main.js) keeps working, because nothing here
// closes over one particular state.

import { updateTraffic, updateWalkers, updateCops } from './actors.js';
import { walkPlayer, drivePlayer, coolHeat } from './player.js';
import { tickMissions, missionText } from './missions.js';

const HEALTH_REGEN = 2.5;

export function drainEvents(state) {
  for (const event of state.events) {
    if (event.type === 'message') {
      state.messages.push({ text: event.text, life: 6 });
      if (state.messages.length > 4) state.messages.shift();
    } else if (event.type === 'crash') {
      state.audio.crash();
    } else if (event.type === 'busted') {
      state.pendingBusted = true;
    } else if (event.type === 'win') {
      state.pendingWin = true;
    }
  }
  state.events.length = 0;
}

export function tickWorld(state, dt) {
  updateTraffic(state, dt);
  updateWalkers(state, dt);
  updateCops(state, dt);
  tickMissions(state, dt, state.now);
  coolHeat(state.player, state.now, dt);
  if (state.player.health < 100 && state.player.wanted.stars === 0) {
    state.player.health = Math.min(100, state.player.health + HEALTH_REGEN * dt);
  }
  if (state.shot) {
    state.shot.t -= dt;
    if (state.shot.t <= 0) state.shot = null;
  }
  for (const msg of state.messages) msg.life -= dt;
  state.messages = state.messages.filter((m) => m.life > 0);
  state.objectiveText = missionText(state);
  drainEvents(state);
}

export function walkStep(state, input, dt, now) {
  walkPlayer(state, input, dt, now);
}

export function driveStep(state, input, dt) {
  drivePlayer(state, input, dt);
}
