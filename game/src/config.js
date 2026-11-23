// SOLMAR — a sun-soaked coastal open-world crime game, original fiction.
// One place for every number the game tunes by: the city grid, the cars, the
// player, the wanted system, the money and the screens. Nothing here is a
// licensed asset; every name, place and face in the game is invented.

export const STEP = 1 / 60;

// The city is 3600 by 2600 world units. Roads form a grid; east of the last
// road is sand, then the ocean. The camera shows a 1280x720 slice of it.
export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROAD_W = 116;
export const CURB = 26;
export const ROAD_LINES_X = [300, 900, 1500, 2100, 2700, 3300];
export const ROAD_LINES_Y = [300, 800, 1300, 1800, 2300];
export const SAND_X = 3360;
export const SEA_X = 3480;

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const MAP_SIZE = 196;
export const MAP_GAP = 14;

// Mara Reyes on foot.
export const ON_FOOT = {
  radius: 14,
  walk: 170,
  run: 265,
  health: 100,
  punchHurt: 12,
  punchReach: 34,
  punchWait: 0.38,
  shotHurt: 34,
  shotReach: 420,
  shotWait: 0.22,
  ammo0: 24,
  ammoTop: 120,
};

// Any car she drives: arcade handling, drift on the handbrake.
export const CAR_TUNE = {
  len: 54,
  wid: 26,
  accel: 420,
  brake: 620,
  backAccel: 260,
  topSpeed: 560,
  topBack: 180,
  steer: 2.6,
  drag: 0.55,
};

// Heat: 0 to 5 stars. Crimes add stars at once; staying clean cools them off.
export const HEAT = {
  top: 5,
  forSteal: 1,
  forAssault: 1,
  forShot: 1,
  forCopDown: 2,
  coolAfter: 14,
  coolRate: 0.12,
  copTopSpeed: [0, 300, 330, 365, 400, 430],
  copHowMany: [0, 1, 2, 3, 4, 5],
  bustDist: 30,
  bustHold: 1.6,
};

// Cash: what Mara starts with and what the city pays her.
export const CASH = {
  start: 250,
  fareBase: 45,
  streetCash: 60,
  bagCash: 300,
  missionPay: [0, 400, 600, 900, 1200, 2500],
};

export const SAVE_KEY = 'solmar-save-v1';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'paused';
export const SCREEN_BUSTED = 'over';
export const SCREEN_WON = 'win';

export const RANKS = ['Street Kid', 'Wheelman', 'Hustler', 'Shot Caller', 'Kingpin of Solmar'];
