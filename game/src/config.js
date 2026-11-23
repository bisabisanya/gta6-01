// SOLMAR — a sun-soaked coastal open-world crime game (original fiction, no licensed assets).
// Shared constants: world size, roads, physics, wanted rules, screens, storage keys.

export const STEP = 1 / 60;
export const WORLD = { width: 3600, height: 2600 };
export const ROAD_WIDTH = 116;
export const SIDEWALK = 26;
// Road centre lines (vertical x, horizontal y). Blocks sit between them.
export const ROADS_X = [300, 900, 1500, 2100, 2700, 3300];
export const ROADS_Y = [300, 800, 1300, 1800, 2300];
// East of the last road: sand, then the ocean.
export const BEACH_X = 3360;
export const OCEAN_X = 3480;

export const VIEW = { width: 1280, height: 720 };
export const MINIMAP = { size: 196, margin: 14 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 170,
  runSpeed: 265,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.38,
  pistolDamage: 34,
  pistolRange: 420,
  pistolCooldown: 0.22,
  ammoStart: 24,
  ammoMax: 120,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.4,
  drag: 0.55,
};

// Wanted: stars 0..5. Heat rises on crimes, decays while clean.
export const WANTED = {
  max: 5,
  stealCar: 1,
  punchPed: 1,
  shoot: 1,
  killCop: 2,
  decayDelay: 14,
  decayPerSecond: 0.12,
  copSpeed: [0, 300, 330, 365, 400, 430],
  copCount: [0, 1, 2, 3, 4, 5],
  bustRadius: 30,
  bustTime: 1.6,
};

export const MONEY = {
  start: 250,
  taxiFare: 45,
  cashPickup: 60,
  missionReward: [0, 400, 600, 900, 1200, 2500],
};

export const SAVE_KEY = 'solmar-save-v1';
export const BEST_KEY = 'solmar-best-v1';

// Screens
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export const RANKS = ['Street Kid', 'Wheelman', 'Hustler', 'Shot Caller', 'Kingpin of Solmar'];
