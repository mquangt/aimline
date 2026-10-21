import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightFraction, shotParams, flightPath, solveAim, analyzeShot, totalDistance } from '../js/shot-model.js';
import { DEFAULT_BAG } from '../js/bag.js';

const driver = DEFAULT_BAG[0];

test('height profile peaks at apex past the midpoint', () => {
  let best = 0, at = 0;
  for (let u = 0; u <= 1; u += 0.005) if (heightFraction(u) > best) { best = heightFraction(u); at = u; }
  assert.ok(Math.abs(best - 1) < 1e-3);
  assert.ok(at > 0.55 && at < 0.6);
});

test('straight driver lands at carry with the bias applied', () => {
  const p = shotParams(driver, 'straight');
  const f = flightPath(p);
  assert.ok(Math.abs(f.landing.y - 220) < 1);
  assert.ok(Math.abs(f.landing.x - 9) < 1e-9);
  assert.ok(Math.abs(f.apexPoint.z - 30) < 0.5); // 90 ft = 30 yds
});

test('aim solve puts the expected finish on the target line', () => {
  for (const shape of ['hook', 'draw', 'straight', 'fade', 'slice']) {
    const p = shotParams(driver, shape);
    const f = flightPath(p, solveAim(p));
    assert.ok(Math.abs(f.finish.x) < 1e-6, `${shape}: finish x ${f.finish.x}`);
  }
});

test('a slicer is told to aim left; lefties are mirrored', () => {
  const r = analyzeShot(DEFAULT_BAG, 0, 'straight', 240);
  assert.ok(r.aim < 0);
  assert.match(r.lines.join(' '), /right on average/);
  const l = analyzeShot(DEFAULT_BAG, 0, 'straight', 240, { hand: 'L' });
  assert.ok(l.aim > 0);
});

test('shapes change height and roll in the expected direction', () => {
  const draw = shotParams(driver, 'draw'), fade = shotParams(driver, 'fade');
  assert.ok(draw.apex < fade.apex);
  assert.ok(draw.roll > fade.roll);
});

test('club suggestion picks a closer club when the target does not fit', () => {
  const r = analyzeShot(DEFAULT_BAG, 0, 'straight', 155, { includeBias: false });
  assert.ok(r.clubTip);
  assert.equal(DEFAULT_BAG[r.clubTip.index].name, '7 Iron');
  assert.ok(Math.abs(totalDistance(shotParams(driver, 'straight', { includeBias: false })) - 240) < 1);
});
