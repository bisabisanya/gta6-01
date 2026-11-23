// Seeded randomness and the small math the whole game leans on. The city, the
// traffic and the pedestrians all grow from one seed, so a fixed seed always
// builds the same Solmar — that is what makes the screenshots reproducible.

export function makeRng(seed) {
  let s = seed >>> 0;
  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    between(lo, hi) {
      return lo + next() * (hi - lo);
    },
    whole(lo, hi) {
      return Math.floor(lo + next() * (hi - lo + 1));
    },
    from(list) {
      return list[Math.floor(next() * list.length)];
    },
    maybe(p) {
      return next() < p;
    },
  };
}

export function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

export function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function heading(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Smallest signed turn from angle a to angle b, in (-PI, PI].
export function turnDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
