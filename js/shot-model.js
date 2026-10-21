// Pure ball-flight + aim math. No DOM, no sensors — this file ports directly to the
// React Native app. Units: yards, except apex which the bag stores in feet.
//
// Aim frame: x = right of aim line, y = downrange, z = up. Ball at the origin.

export const SHAPES = {
  hook:     { label: 'Hook',     curve: -0.11, apex: 0.82, carry: 0.96, roll: 1.6 },
  draw:     { label: 'Draw',     curve: -0.04, apex: 0.93, carry: 1.0,  roll: 1.25 },
  straight: { label: 'Straight', curve: 0,     apex: 1.0,  carry: 1.0,  roll: 1.0 },
  fade:     { label: 'Fade',     curve: 0.04,  apex: 1.06, carry: 0.98, roll: 0.8 },
  slice:    { label: 'Slice',    curve: 0.11,  apex: 1.1,  carry: 0.9,  roll: 0.6 },
};
export const SHAPE_ORDER = ['hook', 'draw', 'straight', 'fade', 'slice'];

// Height profile exponents: apex at a/(a+b) ≈ 57.5% of carry, steeper descent.
const A = 1.15;
const B = 0.85;
const UP = A / (A + B);
const NORM = Math.pow(UP, A) * Math.pow(1 - UP, B);

export function heightFraction(u) {
  if (u <= 0 || u >= 1) return 0;
  return (Math.pow(u, A) * Math.pow(1 - u, B)) / NORM;
}

// Resolve a club + shape into flight parameters. `includeBias` adds the golfer's
// average lateral miss (what the ball *typically* does, not what they intend).
export function shotParams(club, shapeKey = 'straight', { hand = 'R', includeBias = true } = {}) {
  const s = SHAPES[shapeKey] ?? SHAPES.straight;
  const mirror = hand === 'L' ? -1 : 1;
  const carry = club.carry * s.carry;
  const shapeCurve = club.carry * s.curve * mirror;
  const bias = includeBias ? club.bias * mirror : 0;
  return {
    carry,
    apex: (club.apexFt / 3) * s.apex,
    roll: club.roll * s.roll,
    shapeCurve,
    bias,
    curve: shapeCurve + bias,
    latSD: club.latSD,
    carrySD: club.carrySD,
  };
}

const rotate = (x, y, a) => ({ x: x * Math.cos(a) + y * Math.sin(a), y: -x * Math.sin(a) + y * Math.cos(a) });

// Sample the flight. `aim` (radians, + = right) rotates the whole shot about the ball.
export function flightPath(p, aim = 0, samples = 72) {
  const air = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const r = rotate(p.curve * u * u, p.carry * u, aim);
    air.push({ x: r.x, y: r.y, z: p.apex * heightFraction(u) });
  }
  // Roll continues along the landing tangent (dx/dy = 2·curve/carry).
  const tx = (2 * p.curve) / p.carry;
  const len = Math.hypot(tx, 1);
  const land = { x: p.curve, y: p.carry };
  const fin = { x: land.x + (tx / len) * p.roll, y: land.y + (1 / len) * p.roll };
  const landing = { ...rotate(land.x, land.y, aim), z: 0 };
  const finish = { ...rotate(fin.x, fin.y, aim), z: 0 };
  const heading = aim + Math.atan2(tx, 1); // direction of travel at landing
  const apexIdx = Math.round(UP * samples);
  return { air, landing, finish, heading, apexPoint: air[apexIdx] };
}

// Aim offset (radians, + = right) that puts the expected finish on the target line.
export function solveAim(p) {
  const f = flightPath(p, 0, 8).finish;
  return -Math.atan2(f.x, f.y);
}

export function totalDistance(p) {
  const f = flightPath(p, 0, 8).finish;
  return Math.hypot(f.x, f.y);
}

// Closest club by total distance for a given shape.
export function suggestClub(bag, targetYds, shapeKey, opts) {
  let best = null;
  for (let i = 0; i < bag.length; i++) {
    const d = totalDistance(shotParams(bag[i], shapeKey, opts));
    const err = Math.abs(d - targetYds);
    if (!best || err < best.err) best = { index: i, total: d, err };
  }
  return best;
}

const side = (v) => (v >= 0 ? 'right' : 'left');
const deg = (rad) => Math.abs((rad * 180) / Math.PI);

// Everything the HUD needs, in one call.
export function analyzeShot(bag, clubIndex, shapeKey, targetYds, opts = {}) {
  const club = bag[clubIndex];
  const p = shotParams(club, shapeKey, opts);
  const aim = solveAim(p);
  const total = totalDistance(p);
  const naive = flightPath(p, 0, 8).finish; // aiming straight at the target
  const aimYdsAtTarget = Math.tan(aim) * targetYds;
  const lines = [];

  if (Math.abs(p.bias) >= 2) {
    lines.push(`You miss your ${club.name} about ${Math.round(Math.abs(p.bias))} yds ${side(p.bias)} on average.`);
  }
  if (shapeKey !== 'straight') {
    lines.push(`A ${SHAPES[shapeKey].label.toLowerCase()} adds ~${Math.round(Math.abs(p.shapeCurve))} yds of curve ${side(p.shapeCurve)}.`);
  }
  if (Math.abs(aimYdsAtTarget) >= 1.5) {
    lines.push(`Aim ${deg(aim).toFixed(1)}° ${side(aim)} — about ${Math.round(Math.abs(aimYdsAtTarget))} yds ${side(aim)} of your target.`);
  } else {
    lines.push('Aim straight at your target.');
  }

  let clubTip = null;
  if (Math.abs(total - targetYds) > 10) {
    const best = suggestClub(bag, targetYds, shapeKey, opts);
    if (best && best.index !== clubIndex) {
      clubTip = {
        index: best.index,
        text: `${club.name} goes ${Math.round(total)} yds total, ${Math.round(Math.abs(total - targetYds))} ${total > targetYds ? 'long' : 'short'}. ${bag[best.index].name} (${Math.round(best.total)}) fits better.`,
      };
    }
  }

  return {
    params: p,
    aim,
    total,
    naiveMiss: naive.x,
    aimYdsAtTarget,
    lines,
    clubTip,
  };
}
