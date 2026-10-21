// Mock hole for the simulated mode: 395-yd par 4, dogleg right. Tee at the origin,
// playing north (+y). World coords in yards (x = east, y = north).

function ribbon(center, halfWidth) {
  const left = [], right = [];
  for (let i = 0; i < center.length; i++) {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
    const nx = dy / l, ny = -dx / l; // right-hand normal
    const w = typeof halfWidth === 'function' ? halfWidth(i) : halfWidth;
    right.push({ x: center[i].x + nx * w, y: center[i].y + ny * w });
    left.push({ x: center[i].x - nx * w, y: center[i].y - ny * w });
  }
  return [...left, ...right.reverse()];
}

function circle(cx, cy, rx, ry = rx, n = 28, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * rx, y = Math.sin(t) * ry;
    pts.push({ x: cx + x * Math.cos(rot) - y * Math.sin(rot), y: cy + x * Math.sin(rot) + y * Math.cos(rot) });
  }
  return pts;
}

const centerline = [
  { x: 0, y: 40 }, { x: 0, y: 120 }, { x: 2, y: 190 }, { x: 12, y: 235 },
  { x: 40, y: 270 }, { x: 85, y: 300 }, { x: 135, y: 322 }, { x: 165, y: 334 },
];

// Deterministic pseudo-random so the trees don't move between reloads.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const trees = [];
// Inside of the dogleg: a stand of trees that blocks cutting the corner.
for (let i = 0; i < 55; i++) trees.push({ x: 30 + rand() * 110, y: 120 + rand() * 150 });
// Left boundary
for (let y = 30; y < 330; y += 14) trees.push({ x: -38 - rand() * 25, y: y + rand() * 8 });
// Behind the corner / right of the start
for (let y = 20; y < 120; y += 16) trees.push({ x: 32 + rand() * 20, y: y + rand() * 8 });
// Far side of the dogleg
for (let x = -30; x < 200; x += 16) trees.push({ x: x + rand() * 8, y: 365 + rand() * 25 });
trees.forEach((t) => { t.h = 12 + rand() * 9; t.r = 4 + rand() * 3; t.tone = rand(); });

// Keep the fairway clear: drop any tree within 26 yds of the centerline.
function distToCenterline(p) {
  let best = Infinity;
  for (let i = 0; i < centerline.length - 1; i++) {
    const a = centerline[i], b = centerline[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
  }
  return best;
}
const clearTrees = trees.filter((t) => distToCenterline(t) > 26 && Math.hypot(t.x - 178, t.y - 338) > 24);

export const DEMO_HOLE = {
  name: 'Demo #7 · Par 4 · 395 yds',
  teeBearing: 0,
  suggestedTarget: { bearing: 4, distance: 238 },
  tee: [{ x: -6, y: -6 }, { x: 6, y: -6 }, { x: 6, y: 6 }, { x: -6, y: 6 }],
  fairway: ribbon(centerline, (i) => (i < 2 ? 14 : i < 6 ? 18 : 15)),
  green: circle(178, 338, 15, 12, 32, 0.4),
  bunkers: [circle(-14, 255, 9, 5, 20, 0.7), circle(160, 352, 8, 4, 18, 0.3), circle(195, 326, 6, 4, 18, -0.4)],
  pond: circle(110, 345, 18, 9, 28, 0.2),
  flag: { x: 180, y: 338 },
  trees: clearTrees,
};
