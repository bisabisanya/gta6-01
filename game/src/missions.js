// The story: five missions chain Mara's rise from wheelman to the big score.
// Between missions the city offers taxi fares and scattered street cash. Each
// mission is a short list of steps (drive somewhere, grab something, survive
// the heat) with a live objective line on the HUD.

import { CASH } from './config.js';
import { raiseHeat } from './player.js';

const STORY = [
  {
    id: 1, title: 'First Wheels',
    briefing: 'Eddie needs a driver. Steal a car — any car — then bring it to his garage.',
    steps: [
      { type: 'steal', text: 'Steal a car (walk up to one, press E)' },
      { type: 'go', target: 'garage', text: 'Drive to Eddie’s Garage' },
    ],
  },
  {
    id: 2, title: 'The Package',
    briefing: 'A package is waiting at Sunset Pier. Grab it and drop it at the Palmetto Hotel. Fast — the buyer hates waiting.',
    steps: [
      { type: 'go', target: 'pier', text: 'Pick up the package at Sunset Pier' },
      { type: 'go', target: 'hotel', text: 'Deliver the package to the Palmetto Hotel', limit: 90 },
    ],
  },
  {
    id: 3, title: 'Heat Wave',
    briefing: 'The pickup was a setup. Three stars and counting — shake the cops and get to the hideout.',
    steps: [
      { type: 'escape', target: 'hideout', text: 'Lose the cops — reach Mara’s Hideout', stars: 3 },
    ],
  },
  {
    id: 4, title: 'Three Bags Full',
    briefing: 'Eddie stashed three cash bags around the city before the raid. Collect them all.',
    steps: [
      { type: 'bags', count: 3, text: 'Collect the stashed cash bags (3)' },
    ],
  },
  {
    id: 5, title: 'The Big Score',
    briefing: 'Solmar National Bank. In, grab the vault cash, out — and whatever you do, don’t get caught.',
    steps: [
      { type: 'go', target: 'bank', text: 'Reach Solmar National Bank' },
      { type: 'escape', target: 'hideout', text: 'Escape to the hideout with the vault cash', stars: 4, reward: 2500 },
    ],
  },
];

export function newMissions(city) {
  // Story defs are module constants: clear per-run flags so a fresh game re-arms them.
  for (const def of STORY) for (const step of def.steps) delete step.armed;
  const pickups = [];
  const spots = [
    { x: city.spots.park.x - 120, y: city.spots.park.y + 40 },
    { x: city.spots.pier.x - 160, y: city.spots.pier.y - 120 },
    { x: 2700, y: 300 },
    { x: 300, y: 1300 },
    { x: 2100, y: 1800 },
    { x: 1500, y: 800 },
  ];
  for (const s of spots) pickups.push({ x: s.x, y: s.y, taken: false, amount: CASH.streetCash });
  // Mission 4's bags: three fixed stashes.
  const bags = [
    { x: city.spots.park.x + 90, y: city.spots.park.y - 60, taken: false },
    { x: 2700, y: 1800, taken: false },
    { x: 900, y: 300, taken: false },
  ];
  return {
    defs: STORY,
    index: 0, step: 0, timer: 0, collected: 0,
    active: true, finished: false,
    pickups, bags,
    fare: null, fareWait: 8,
    marker: null,
  };
}

function currentJob(missions) {
  return missions.defs[missions.index] || null;
}

function pointMarker(state, x, y, label) {
  state.missions.marker = { x, y, label };
}

export function missionText(state) {
  const { missions } = state;
  if (missions.finished) return 'Free roam — Solmar is yours. Taxi fares and cash are still out there.';
  const def = currentJob(missions);
  if (!def) return '';
  return `${def.title}: ${def.steps[missions.step].text}`;
}

function finishMission(state) {
  const { player, missions } = state;
  const def = currentJob(missions);
  const reward = CASH.missionPay[def.id] || 400;
  player.cash += reward;
  player.missionsDone += 1;
  state.audio.mission();
  state.events.push({ type: 'message', text: `Mission complete: ${def.title} — +$${reward}` });
  missions.index += 1;
  missions.step = 0;
  missions.collected = 0;
  missions.timer = 0;
  missions.marker = null;
  if (missions.index >= missions.defs.length) {
    missions.finished = true;
    missions.active = false;
    state.events.push({ type: 'win' });
  } else {
    const next = currentJob(missions);
    state.events.push({ type: 'message', text: `New mission: ${next.title} — ${next.briefing}` });
  }
}

function nextStep(state) {
  const { missions } = state;
  const def = currentJob(missions);
  missions.step += 1;
  missions.timer = 0;
  if (missions.step >= def.steps.length) finishMission(state);
}

export function tickMissions(state, dt, now) {
  const { player, missions, city } = state;
  const def = currentJob(missions);
  if (def && missions.active) {
    const step = def.steps[missions.step];
    if (step.type === 'steal') {
      pointMarker(state, player.x, player.y, 'Find a car');
      if (player.mode === 'car') nextStep(state);
    } else if (step.type === 'go') {
      const t = city.spots[step.target];
      pointMarker(state, t.x, t.y, t.name);
      if (step.limit) {
        missions.timer += dt;
        if (missions.timer > step.limit) {
          state.events.push({ type: 'message', text: 'Too slow! The buyer walked. Try again.' });
          state.audio.fail();
          missions.step = 0;
          missions.timer = 0;
        }
      }
      if (Math.hypot(player.x - t.x, player.y - t.y) < 70) nextStep(state);
    } else if (step.type === 'escape') {
      const t = city.spots[step.target];
      pointMarker(state, t.x, t.y, t.name);
      if (!step.armed) {
        step.armed = true;
        player.wanted.stars = step.stars;
        player.wanted.heat = 100;
        player.wanted.lastCrime = now;
        state.audio.siren();
      }
      const d = Math.hypot(player.x - t.x, player.y - t.y);
      if (d < 80 && player.wanted.stars <= 1) nextStep(state);
      else if (d < 80 && player.wanted.stars > 1) {
        state.events.push({ type: 'message', text: 'Too hot! Lose the cops first, then slip in.' });
      }
    } else if (step.type === 'bags') {
      const left = missions.bags.filter((b) => !b.taken);
      if (left.length === 0) {
        nextStep(state);
      } else {
        const nextBag = left[0];
        pointMarker(state, nextBag.x, nextBag.y, 'Cash bag');
        for (const bag of left) {
          if (Math.hypot(player.x - bag.x, player.y - bag.y) < 46) {
            bag.taken = true;
            missions.collected += 1;
            player.cash += CASH.bagCash;
            state.audio.cash();
            state.events.push({ type: 'message', text: `Cash bag grabbed (+$${CASH.bagCash}) — ${missions.collected}/3` });
          }
        }
      }
    }
  }

  // Street cash pickups.
  for (const p of missions.pickups) {
    if (p.taken) continue;
    if (Math.hypot(player.x - p.x, player.y - p.y) < 40) {
      p.taken = true;
      player.cash += p.amount;
      player.pickups += 1;
      if (Math.random() < 0.5) player.ammo = Math.min(player.ammo + 12, 120);
      state.audio.pickup();
      state.events.push({ type: 'message', text: `Found street cash +$${p.amount}` });
    }
  }

  // Taxi fares: offered while driving between missions, one at a time.
  missions.fareWait -= dt;
  if (!missions.fare && missions.fareWait <= 0 && player.mode === 'car' && !def) beginFare(state);
  if (missions.fare) tickFare(state);
}

function beginFare(state) {
  const { city } = state;
  const p = city.randomRoadSpot();
  const dest = city.randomRoadSpot();
  state.missions.fare = {
    phase: 'pickup',
    x: p.x, y: p.y, destX: dest.x, destY: dest.y,
    fare: CASH.fareBase + Math.floor(Math.hypot(dest.x - p.x, dest.y - p.y) / 400) * 10,
  };
  state.events.push({ type: 'message', text: 'Taxi fare nearby — pick up the passenger (yellow marker).' });
}

function tickFare(state) {
  const { player, missions } = state;
  const fare = missions.fare;
  const goal = fare.phase === 'pickup' ? { x: fare.x, y: fare.y } : { x: fare.destX, y: fare.destY };
  pointMarker(state, goal.x, goal.y, fare.phase === 'pickup' ? 'Passenger' : 'Drop-off');
  if (Math.hypot(player.x - goal.x, player.y - goal.y) < 70) {
    if (fare.phase === 'pickup') {
      fare.phase = 'dropoff';
      state.events.push({ type: 'message', text: 'Passenger aboard — drive to the drop-off.' });
    } else {
      player.cash += fare.fare;
      player.faresDone += 1;
      state.audio.cash();
      state.events.push({ type: 'message', text: `Fare complete +$${fare.fare}` });
      missions.fare = null;
      missions.fareWait = 20;
      missions.marker = null;
    }
  }
}
