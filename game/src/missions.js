// Story missions, taxi fares and cash pickups. Five missions chain Mara's rise from wheelman to
// the big score; between them the city offers taxi fares and scattered cash. Each mission is a
// list of steps (drive somewhere, grab something, survive the heat) with a live objective line.
import { MONEY, WANTED } from './config.js';
import { addHeat } from './player.js';

const MISSION_DEFS = [
  {
    id: 1, title: 'First Wheels',
    briefing: 'Eddie needs a driver. Steal a car — any car — then bring it to his garage.',
    steps: [
      { type: 'enterCar', text: 'Steal a car (walk up to one, press E)' },
      { type: 'goto', target: 'garage', text: 'Drive to Eddie\u2019s Garage' },
    ],
  },
  {
    id: 2, title: 'The Package',
    briefing: 'A package is waiting at Sunset Pier. Grab it and drop it at the Palmetto Hotel. Fast — the buyer hates waiting.',
    steps: [
      { type: 'goto', target: 'pier', text: 'Pick up the package at Sunset Pier' },
      { type: 'goto', target: 'hotel', text: 'Deliver the package to the Palmetto Hotel', timer: 90 },
    ],
  },
  {
    id: 3, title: 'Heat Wave',
    briefing: 'The pickup was a setup. Three stars and counting — shake the cops and get to the hideout.',
    steps: [
      { type: 'escape', target: 'hideout', text: 'Lose the cops — reach Mara\u2019s Hideout', wanted: 3 },
    ],
  },
  {
    id: 4, title: 'Three Bags Full',
    briefing: 'Eddie stashed three cash bags around the city before the raid. Collect them all.',
    steps: [
      { type: 'collect', count: 3, text: 'Collect the stashed cash bags (3)' },
    ],
  },
  {
    id: 5, title: 'The Big Score',
    briefing: 'Solmar National Bank. In, grab the vault cash, out — and whatever you do, don\u2019t get caught.',
    steps: [
      { type: 'goto', target: 'bank', text: 'Reach Solmar National Bank' },
      { type: 'escape', target: 'hideout', text: 'Escape to the hideout with the vault cash', wanted: 4, reward: 2500 },
    ],
  },
];

export function createMissions(world, rng) {
  // Mission defs are module constants: clear per-run flags so a fresh game re-arms them.
  for (const def of MISSION_DEFS) for (const step of def.steps) delete step.armed;
  const pickups = [];
  const spots = [
    { x: world.landmarks.park.x - 120, y: world.landmarks.park.y + 40 },
    { x: world.landmarks.pier.x - 160, y: world.landmarks.pier.y - 120 },
    { x: 2700, y: 300 },
    { x: 300, y: 1300 },
    { x: 2100, y: 1800 },
    { x: 1500, y: 800 },
  ];
  for (const s of spots) pickups.push({ x: s.x, y: s.y, taken: false, amount: MONEY.cashPickup });
  // Mission 4's bags: three fixed stashes.
  const bags = [
    { x: world.landmarks.park.x + 90, y: world.landmarks.park.y - 60, taken: false },
    { x: 2700, y: 1800, taken: false },
    { x: 900, y: 300, taken: false },
  ];
  return {
    defs: MISSION_DEFS,
    index: 0, step: 0, timer: 0, collected: 0,
    active: true, finished: false,
    pickups, bags,
    taxi: null, taxiCooldown: 8,
    marker: null, objective: '',
  };
}

function currentDef(missions) {
  return missions.defs[missions.index] || null;
}

function setMarker(state, x, y, label) {
  state.missions.marker = { x, y, label };
}

export function missionObjective(state) {
  const { missions } = state;
  if (missions.finished) return 'Free roam — Solmar is yours. Taxi fares and cash are still out there.';
  const def = currentDef(missions);
  if (!def) return '';
  const step = def.steps[missions.step];
  return `${def.title}: ${step.text}`;
}

function completeMission(state) {
  const { player, missions } = state;
  const def = currentDef(missions);
  const reward = MONEY.missionReward[def.id] || 400;
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
    const next = currentDef(missions);
    state.events.push({ type: 'message', text: `New mission: ${next.title} — ${next.briefing}` });
  }
}

function advanceStep(state) {
  const { missions } = state;
  const def = currentDef(missions);
  missions.step += 1;
  missions.timer = 0;
  if (missions.step >= def.steps.length) completeMission(state);
}

export function updateMissions(state, dt, now) {
  const { player, missions, world } = state;
  const def = currentDef(missions);
  if (def && missions.active) {
    const step = def.steps[missions.step];
    if (step.type === 'enterCar') {
      setMarker(state, player.x, player.y, 'Find a car');
      if (player.mode === 'car') advanceStep(state);
    } else if (step.type === 'goto') {
      const t = world.landmarks[step.target];
      setMarker(state, t.x, t.y, t.label);
      if (step.timer) {
        missions.timer += dt;
        if (missions.timer > step.timer) {
          state.events.push({ type: 'message', text: 'Too slow! The buyer walked. Try again.' });
          state.audio.fail();
          missions.step = 0;
          missions.timer = 0;
        }
      }
      const d = Math.hypot(player.x - t.x, player.y - t.y);
      if (d < 70) advanceStep(state);
    } else if (step.type === 'escape') {
      const t = world.landmarks[step.target];
      setMarker(state, t.x, t.y, t.label);
      if (missions.step === 0 && !step.armed) {
        step.armed = true;
        player.wanted.stars = step.wanted;
        player.wanted.heat = 100;
        player.wanted.lastCrime = now;
        state.audio.siren();
      }
      const d = Math.hypot(player.x - t.x, player.y - t.y);
      if (d < 80 && player.wanted.stars <= 1) advanceStep(state);
      else if (d < 80 && player.wanted.stars > 1) {
        state.events.push({ type: 'message', text: 'Too hot! Lose the cops first, then slip in.' });
      }
    } else if (step.type === 'collect') {
      const remaining = missions.bags.filter((b) => !b.taken);
      if (remaining.length === 0) {
        advanceStep(state);
      } else {
        const next = remaining[0];
        setMarker(state, next.x, next.y, 'Cash bag');
        for (const bag of remaining) {
          if (Math.hypot(player.x - bag.x, player.y - bag.y) < 46) {
            bag.taken = true;
            missions.collected += 1;
            player.cash += 300;
            state.audio.cash();
            state.events.push({ type: 'message', text: `Cash bag grabbed (+$300) — ${missions.collected}/3` });
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
  missions.taxiCooldown -= dt;
  if (!missions.taxi && missions.taxiCooldown <= 0 && player.mode === 'car' && !def) {
    startTaxi(state);
  }
  if (missions.taxi) updateTaxi(state, dt);
}

function startTaxi(state) {
  const { world, player } = state;
  const p = world.randomRoadPoint();
  const dest = world.randomRoadPoint();
  state.missions.taxi = {
    phase: 'pickup',
    x: p.x, y: p.y, destX: dest.x, destY: dest.y,
    fare: MONEY.taxiFare + Math.floor(Math.hypot(dest.x - p.x, dest.y - p.y) / 400) * 10,
  };
  state.events.push({ type: 'message', text: 'Taxi fare nearby — pick up the passenger (yellow marker).' });
}

function updateTaxi(state, dt) {
  const { player, missions } = state;
  const taxi = missions.taxi;
  const target = taxi.phase === 'pickup' ? { x: taxi.x, y: taxi.y } : { x: taxi.destX, y: taxi.destY };
  setMarker(state, target.x, target.y, taxi.phase === 'pickup' ? 'Passenger' : 'Drop-off');
  const d = Math.hypot(player.x - target.x, player.y - target.y);
  if (d < 70) {
    if (taxi.phase === 'pickup') {
      taxi.phase = 'dropoff';
      state.events.push({ type: 'message', text: 'Passenger aboard — drive to the drop-off.' });
    } else {
      player.cash += taxi.fare;
      player.faresDone += 1;
      state.audio.cash();
      state.events.push({ type: 'message', text: `Fare complete +$${taxi.fare}` });
      missions.taxi = null;
      missions.taxiCooldown = 20;
      missions.marker = null;
    }
  }
}

export function wantedForShot(state) {
  return state.player.wanted.stars;
}
