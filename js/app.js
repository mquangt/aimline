import { SHAPES, SHAPE_ORDER, shotParams, flightPath, analyzeShot, totalDistance } from './shot-model.js';
import { DEFAULT_BAG, loadSettings, saveSettings, cloneBag } from './bag.js';
import { Camera, rotationFromHeadingPitch, smoothRotation, viewAngles, aimToWorld } from './camera-math.js';
import { DEMO_HOLE } from './course.js';
import { startCamera, startOrientation, startGps } from './sensors.js';
import { render } from './renderer.js';

const $ = (id) => document.getElementById(id);
const saved = loadSettings();

const state = {
  mode: null, // 'ar' | 'sim'
  bag: saved?.bag ?? cloneBag(DEFAULT_BAG),
  hand: saved?.hand ?? 'R',
  fov: saved?.fov ?? 70,
  eye: saved?.eye ?? 1.75,
  clubIdx: 0,
  shape: 'straight',
  bearing: DEMO_HOLE.suggestedTarget.bearing,
  targetDist: DEMO_HOLE.suggestedTarget.distance,
  showGhost: true,
  showZone: true,
  includeBias: true,
  simHeading: 6,
  simPitch: 0,
  simView: 'eye', // 'eye' | 'drone'
  sensorR: null,
  compassAccuracy: null,
  gps: null,
  animStart: performance.now(),
};

const cam = new Camera();
const canvas = $('overlay');
const ctx = canvas.getContext('2d');
let analysis = null, path = null, ghostPath = null;

const persist = () => saveSettings({ bag: state.bag, hand: state.hand, fov: state.fov, eye: state.eye });

// ---------- model ----------

function recompute({ restart = true } = {}) {
  const opts = { hand: state.hand, includeBias: state.includeBias };
  analysis = analyzeShot(state.bag, state.clubIdx, state.shape, state.targetDist, opts);
  path = flightPath(analysis.params, analysis.aim);
  ghostPath = Math.abs(analysis.naiveMiss) > 1.5 ? flightPath(analysis.params, 0) : null;
  if (restart) state.animStart = performance.now();
  renderHud();
}

// ---------- HUD ----------

function renderHud() {
  const club = state.bag[state.clubIdx];
  const p = analysis.params;
  $('hud-club').textContent = club.name;
  $('hud-stats').textContent = `${Math.round(p.carry)} carry · ${Math.round(p.apex * 3)} ft apex · ${Math.round(analysis.total)} total`;

  const deg = (analysis.aim * 180) / Math.PI;
  const yds = Math.abs(analysis.aimYdsAtTarget);
  if (Math.abs(deg) < 0.3) {
    $('tip-aim-big').textContent = 'ON LINE';
    $('tip-aim-sub').textContent = 'aim at the target';
  } else {
    const dir = deg < 0 ? 'L' : 'R';
    $('tip-aim-big').textContent = `${Math.abs(deg).toFixed(1)}° ${dir}`;
    $('tip-aim-sub').textContent = `${Math.round(yds)} yds ${deg < 0 ? 'left' : 'right'} of target`;
  }
  const ul = $('tip-lines');
  ul.replaceChildren(...analysis.lines.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  const tipBtn = $('tip-club');
  if (analysis.clubTip) {
    tipBtn.hidden = false;
    tipBtn.textContent = `${analysis.clubTip.text} Switch →`;
    tipBtn.onclick = () => selectClub(analysis.clubTip.index);
  } else tipBtn.hidden = true;

  $('dist-val').textContent = Math.round(state.targetDist);
  $('dist').value = Math.round(state.targetDist);
  document.querySelectorAll('#clubs .pill').forEach((el, i) => el.setAttribute('aria-checked', String(i === state.clubIdx)));
  document.querySelectorAll('#shapes .pill').forEach((el) => el.setAttribute('aria-checked', String(el.dataset.shape === state.shape)));
}

function buildPills() {
  $('shapes').replaceChildren(...SHAPE_ORDER.map((k) => {
    const b = document.createElement('button');
    b.className = 'pill'; b.dataset.shape = k; b.setAttribute('role', 'radio'); b.textContent = SHAPES[k].label;
    b.onclick = () => { state.shape = k; recompute(); };
    return b;
  }));
  $('clubs').replaceChildren(...state.bag.map((c, i) => {
    const b = document.createElement('button');
    b.className = 'pill'; b.setAttribute('role', 'radio');
    const tot = Math.round(totalDistance(shotParams(c, 'straight', { hand: state.hand, includeBias: false })));
    b.innerHTML = `${c.short}<span class="sub">${tot}</span>`;
    b.onclick = () => selectClub(i);
    return b;
  }));
}

function selectClub(i) {
  state.clubIdx = i;
  recompute();
  document.querySelectorAll('#clubs .pill')[i]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}

// ---------- settings ----------

const FIELDS = ['carry', 'apexFt', 'roll', 'bias', 'latSD', 'carrySD'];

function buildBagTable() {
  $('bag-body').replaceChildren(...state.bag.map((c, i) => {
    const tr = document.createElement('tr');
    const name = document.createElement('td'); name.textContent = c.name; tr.append(name);
    for (const f of FIELDS) {
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number'; inp.inputMode = 'decimal'; inp.id = `bag-${i}-${f}`; inp.value = c[f];
      inp.setAttribute('aria-label', `${c.name} ${f}`);
      inp.onchange = () => {
        const v = parseFloat(inp.value);
        if (Number.isFinite(v)) { c[f] = v; persist(); buildPills(); recompute(); }
      };
      td.append(inp); tr.append(td);
    }
    return tr;
  }));
  $('set-hand').value = state.hand;
  $('set-fov').value = state.fov;
  $('set-eye').value = state.eye;
}

$('btn-settings').onclick = () => { buildBagTable(); $('settings').showModal(); };
$('set-hand').onchange = (e) => { state.hand = e.target.value; persist(); buildPills(); recompute(); };
$('set-fov').onchange = (e) => { const v = +e.target.value; if (v >= 30 && v <= 100) { state.fov = v; persist(); } };
$('set-eye').onchange = (e) => { const v = +e.target.value; if (v >= 1 && v <= 2.5) { state.eye = v; persist(); } };
$('btn-reset').onclick = () => { state.bag = cloneBag(DEFAULT_BAG); persist(); buildBagTable(); buildPills(); recompute(); };
$('btn-exit').onclick = () => location.reload();

// ---------- controls ----------

$('dist').oninput = (e) => { state.targetDist = +e.target.value; recompute({ restart: false }); };
$('btn-view').onclick = () => {
  state.simView = state.simView === 'eye' ? 'drone' : 'eye';
  $('btn-view').textContent = state.simView === 'eye' ? 'EYE LEVEL' : 'DRONE';
};
$('tg-ghost').onchange = (e) => { state.showGhost = e.target.checked; };
$('tg-zone').onchange = (e) => { state.showZone = e.target.checked; };
$('tg-bias').onchange = (e) => { state.includeBias = e.target.checked; recompute(); };

function setTargetFromScreen(sx, sy) {
  const g = cam.groundAt(sx, sy);
  const ray = cam.rayAt(sx, sy);
  const d = g ? Math.hypot(g.x, g.y) : Infinity;
  // Far-away ground taps are too pitch-sensitive to trust in AR; use only their direction.
  const trusted = d >= 30 && d <= 330 && (state.mode === 'sim' || d < 120);
  const bearing = trusted ? Math.atan2(g.x, g.y) : Math.atan2(ray[0], ray[1]);
  state.bearing = ((bearing * 180) / Math.PI + 360) % 360;
  if (trusted) state.targetDist = d;
  recompute();
}

$('btn-target').onclick = () => setTargetFromScreen(cam.width / 2, cam.height / 2);

// Drag to look around (demo), tap to set target (both modes).
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, h: state.simHeading, p: state.simPitch, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 6) drag.moved = true;
  if (state.mode === 'sim' && drag.moved) {
    const k = state.fov / cam.height;
    state.simHeading = (drag.h - dx * k + 360) % 360;
    state.simPitch = Math.max(-35, Math.min(25, drag.p + dy * k));
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved) setTargetFromScreen(e.clientX, e.clientY);
  drag = null;
});
window.addEventListener('keydown', (e) => {
  if (state.mode !== 'sim') return;
  const step = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (!step) return;
  state.simHeading = (state.simHeading + step[0] + 360) % 360;
  state.simPitch = Math.max(-35, Math.min(25, state.simPitch + step[1]));
});

// ---------- loop ----------

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cam.width = window.innerWidth; cam.height = window.innerHeight;
  canvas.width = Math.round(cam.width * dpr); canvas.height = Math.round(cam.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cam.screenAngle = screen.orientation?.angle ?? window.orientation ?? 0;
}
window.addEventListener('resize', resize);
screen.orientation?.addEventListener?.('change', resize);

function frame(now) {
  requestAnimationFrame(frame);
  if (!state.mode) return;

  // Portrait FOV setting; in landscape the vertical FOV shrinks by the aspect ratio.
  const portrait = cam.height >= cam.width;
  cam.vfov = portrait ? state.fov : (2 * Math.atan(Math.tan((state.fov * Math.PI) / 360) * (cam.height / cam.width)) * 180) / Math.PI;
  const drone = state.mode === 'sim' && state.simView === 'drone';
  const pitch = drone ? state.simPitch - 22 : state.simPitch;
  cam.R = state.mode === 'sim' ? rotationFromHeadingPitch(state.simHeading, pitch) : (state.sensorR ?? cam.R);
  // Eye level: standing just behind and left of the ball. Drone: high chase view.
  const back = aimToWorld(drone ? { x: -8, y: -70 } : { x: -0.6, y: -3.5 }, state.bearing);
  cam.pos = { x: back.x, y: back.y, z: drone ? 48 : state.eye };

  const heading = viewAngles(cam.R).heading;
  const chip = $('chip-heading');
  chip.textContent = `${String(Math.round(heading) % 360).padStart(3, '0')}°`;
  const acc = state.compassAccuracy;
  chip.classList.toggle('warn', state.mode === 'ar' && (acc === -1 || acc > 25));

  const t = (now - state.animStart) / 1000;
  const progress = Math.min(1, (t % 4.2) / 2.8);

  render(ctx, cam, {
    mode: state.mode,
    hole: DEMO_HOLE,
    origin: { x: 0, y: 0 },
    bearing: state.bearing,
    targetDist: state.targetDist,
    aim: analysis.aim,
    params: analysis.params,
    path,
    ghostPath,
    showGhost: state.showGhost,
    showZone: state.showZone,
    progress,
  });
}

// ---------- start ----------

function enter(mode) {
  state.mode = mode;
  $('start').hidden = true;
  $('hud').hidden = false;
  $('controls').hidden = false;
  $('reticle').hidden = mode !== 'ar';
  $('video').hidden = mode !== 'ar';
  $('chip-mode').textContent = 'AR';
  $('chip-mode').hidden = mode !== 'ar';
  $('btn-view').hidden = mode !== 'sim';
  if (mode === 'sim') {
    $('hint').hidden = false;
    setTimeout(() => { $('hint').style.opacity = '0'; }, 4500);
  }
  resize();
  recompute();
}

$('btn-sim').onclick = () => enter('sim');

$('btn-ar').onclick = async () => {
  const err = $('start-error');
  err.hidden = true;
  try {
    // Ask for orientation first: iOS only allows the prompt inside the tap handler.
    await startOrientation((R, info) => {
      state.sensorR = smoothRotation(state.sensorR, R, 0.25);
      state.compassAccuracy = info.accuracy;
    });
    await startCamera($('video'));
    startGps((fix) => {
      state.gps = fix;
      $('chip-mode').textContent = fix ? `AR · GPS ±${Math.round(fix.accuracy)}m` : 'AR · NO GPS';
    });
    // Point the target where the phone is facing once the first reading lands.
    setTimeout(() => {
      if (state.sensorR) state.bearing = viewAngles(state.sensorR).heading;
      state.targetDist = Math.round(totalDistance(shotParams(state.bag[state.clubIdx], 'straight', { includeBias: false })));
      recompute();
    }, 600);
    enter('ar');
  } catch (e) {
    err.textContent = `${e.message || e} Try the demo hole instead.`;
    err.hidden = false;
  }
};

buildPills();
recompute();
resize();
requestAnimationFrame(frame);

// Deep link for testing: index.html#demo opens the simulated hole directly.
if (location.hash === '#demo') enter('sim');
