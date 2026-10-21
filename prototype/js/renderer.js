// Canvas overlay: shot tracer, aim line, target, dispersion zone, and (demo mode)
// the simulated hole. Everything is placed in world space and projected through Camera.

import { aimToWorld } from './camera-math.js';

const C = {
  tracer: '#ff4530',
  tracerCore: '#fff2d6',
  ghost: 'rgba(255,255,255,0.75)',
  aim: '#ffd23f',
  target: '#4ee6ff',
  zone: 'rgba(255,69,48,0.16)',
  zoneEdge: 'rgba(255,69,48,0.7)',
  label: '#ffffff',
  halo: 'rgba(8,14,10,0.85)',
  shadow: 'rgba(0,0,0,0.35)',
};
const FONT = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';

function pathTo(ctx, pts) {
  ctx.beginPath();
  let pen = false;
  for (const p of pts) {
    if (!p) { pen = false; continue; }
    if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; }
  }
}

function fillPoly(ctx, cam, poly, style) {
  const s = cam.projectPolygon(poly);
  if (s.length < 3) return null;
  ctx.beginPath();
  s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (style) { ctx.fillStyle = style; ctx.fill(); }
  return s;
}

function label(ctx, text, x, y, { size = 15, color = C.label, align = 'center', weight = 600 } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.halo;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// ---------- demo course ----------

function drawCourse(ctx, cam, hole) {
  const { width: W, height: H } = cam;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#5f9fd8');
  sky.addColorStop(0.55, '#b9d8ee');
  sky.addColorStop(1, '#e4eef2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const far = 4000;
  const ground = fillPoly(ctx, cam, [{ x: -far, y: -far }, { x: far, y: -far }, { x: far, y: far }, { x: -far, y: far }], '#4f7d3a');
  if (ground) {
    // Atmospheric haze toward the horizon.
    const top = Math.min(...ground.map((p) => p.y));
    const g = ctx.createLinearGradient(0, top, 0, top + H * 0.25);
    g.addColorStop(0, 'rgba(200,220,215,0.85)');
    g.addColorStop(1, 'rgba(200,220,215,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H * 0.25);
  }

  // Fairway with mowing stripes.
  const fw = fillPoly(ctx, cam, hole.fairway, '#6fae45');
  if (fw) {
    ctx.save();
    ctx.clip();
    for (let y = 0; y < 420; y += 24) {
      fillPoly(ctx, cam, [{ x: -200, y }, { x: 400, y }, { x: 400, y: y + 12 }, { x: -200, y: y + 12 }], 'rgba(255,255,255,0.07)');
    }
    ctx.restore();
  }
  fillPoly(ctx, cam, hole.tee, '#7cbc52');
  fillPoly(ctx, cam, hole.pond, '#3f7fa8');
  hole.bunkers.forEach((b) => fillPoly(ctx, cam, b, '#e9dcb4'));
  fillPoly(ctx, cam, hole.green, '#86c95a');

  // Flag
  const fb = cam.project({ ...hole.flag, z: 0 }), ft = cam.project({ ...hole.flag, z: 2.6 });
  if (fb && ft) {
    ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fb.x, fb.y); ctx.lineTo(ft.x, ft.y); ctx.stroke();
    const w = Math.max(3, (1.2 * cam.focal) / ft.d);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(ft.x, ft.y); ctx.lineTo(ft.x + w, ft.y + w * 0.35); ctx.lineTo(ft.x, ft.y + w * 0.7); ctx.fill();
  }

  // Trees, far to near.
  const ts = hole.trees
    .map((t) => ({ t, base: cam.project({ x: t.x, y: t.y, z: 0 }), crown: cam.project({ x: t.x, y: t.y, z: t.h * 0.62 }) }))
    .filter((o) => o.base && o.crown)
    .sort((a, b) => b.base.d - a.base.d);
  for (const { t, base, crown } of ts) {
    const r = (t.r * cam.focal) / crown.d;
    const fog = Math.min(0.55, base.d / 900);
    ctx.strokeStyle = `rgba(70,50,35,${1 - fog})`;
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(crown.x, crown.y); ctx.stroke();
    const g = 70 + Math.round(t.tone * 40);
    ctx.fillStyle = `rgb(${32 + fog * 140},${g + fog * 100},${36 + fog * 140})`;
    ctx.beginPath();
    ctx.ellipse(crown.x, crown.y - r * 0.3, r, r * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- shot overlay ----------

function yardageArcs(ctx, cam, bearing, origin) {
  ctx.lineWidth = 1.5;
  for (const yd of [100, 150, 200, 250, 300]) {
    const pts = [];
    for (let a = -22; a <= 22; a += 2) {
      const r = (a * Math.PI) / 180;
      pts.push(cam.project(aimToWorld({ x: Math.sin(r) * yd, y: Math.cos(r) * yd }, bearing, origin)));
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 8]);
    pathTo(ctx, pts);
    ctx.stroke();
    ctx.setLineDash([]);
    const l = pts[0];
    if (l) label(ctx, `${yd}`, l.x - 4, l.y, { size: 13, align: 'right', color: 'rgba(255,255,255,0.85)' });
  }
}

function zone(ctx, cam, path, params, bearing, origin) {
  const h = path.heading;
  const dir = { x: Math.sin(h), y: Math.cos(h) }, nrm = { x: Math.cos(h), y: -Math.sin(h) };
  const c = path.finish;
  for (const k of [2, 1]) {
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      const a = Math.cos(t) * params.carrySD * k, b = Math.sin(t) * params.latSD * k;
      pts.push(aimToWorld({ x: c.x + dir.x * a + nrm.x * b, y: c.y + dir.y * a + nrm.y * b }, bearing, origin));
    }
    if (fillPoly(ctx, cam, pts, C.zone)) {
      ctx.strokeStyle = C.zoneEdge;
      ctx.lineWidth = k === 1 ? 2 : 1;
      ctx.setLineDash(k === 1 ? [] : [5, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// align: which side of the pole the label sits on ('center' | 'left' | 'right').
function pole(ctx, cam, p, color, text, align = 'center') {
  const b = cam.project({ ...p, z: 0 }), t = cam.project({ ...p, z: 7 });
  if (!b || !t) return;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, Math.PI * 2); ctx.fill();
  const dx = align === 'left' ? -6 : align === 'right' ? 6 : 0;
  const textAlign = align === 'left' ? 'right' : align === 'right' ? 'left' : 'center';
  label(ctx, text, t.x + dx, t.y - 12, { size: 15, color, weight: 700, align: textAlign });
}

// Two labels near the same spot: push the left one left and the right one right.
function sideBySide(ctx, a, b, y) {
  const [l, r] = a.p.x <= b.p.x ? [a, b] : [b, a];
  label(ctx, l.text, l.p.x - 6, y(l.p), { size: 13, align: 'right', color: l.color });
  label(ctx, r.text, r.p.x + 6, y(r.p), { size: 13, align: 'left', color: r.color });
}

function ring(ctx, cam, c, r, color) {
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    pts.push(cam.project({ x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r, z: 0 }));
  }
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  pathTo(ctx, pts); ctx.stroke();
}

// progress: 0..1 over air + roll. Returns nothing; draws the tracer up to progress.
function tracer(ctx, cam, path, bearing, origin, progress, { ghost = false } = {}) {
  const air = path.air.map((p) => aimToWorld(p, bearing, origin));
  const airFrac = 0.86;
  const airT = Math.min(1, progress / airFrac);
  const n = Math.max(1, Math.round(airT * (air.length - 1)));
  const shown = air.slice(0, n + 1);

  // Ground shadow first.
  const shadow = shown.map((p) => cam.project({ x: p.x, y: p.y, z: 0 }));
  ctx.strokeStyle = C.shadow; ctx.lineWidth = 3;
  pathTo(ctx, shadow); ctx.stroke();

  const scr = shown.map((p) => cam.project(p));
  if (ghost) {
    ctx.strokeStyle = C.ghost; ctx.lineWidth = 2; ctx.setLineDash([7, 7]);
    pathTo(ctx, scr); ctx.stroke(); ctx.setLineDash([]);
  } else {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = C.tracer; ctx.shadowBlur = 14;
    ctx.strokeStyle = C.tracer; ctx.lineWidth = 7;
    pathTo(ctx, scr); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = C.tracerCore; ctx.lineWidth = 2.2;
    pathTo(ctx, scr); ctx.stroke();
    ctx.restore();
  }

  // Roll-out on the ground.
  if (progress > airFrac) {
    const rt = Math.min(1, (progress - airFrac) / (1 - airFrac));
    const L = aimToWorld(path.landing, bearing, origin), F = aimToWorld(path.finish, bearing, origin);
    const end = { x: L.x + (F.x - L.x) * rt, y: L.y + (F.y - L.y) * rt, z: 0 };
    const a = cam.project(L), b = cam.project(end);
    if (a && b) {
      ctx.strokeStyle = ghost ? C.ghost : C.tracer; ctx.lineWidth = ghost ? 2 : 3; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // Ball at the head of the tracer.
  const head = progress > airFrac ? null : scr[scr.length - 1];
  if (head && !ghost) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(head.x, head.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
}

export function render(ctx, cam, s) {
  const { width: W, height: H } = cam;
  ctx.clearRect(0, 0, W, H);
  if (s.mode === 'sim') drawCourse(ctx, cam, s.hole);

  const o = s.origin;
  yardageArcs(ctx, cam, s.bearing, o);

  // Target line (faint) and aim line (bold) along the ground.
  const tgt = aimToWorld({ x: 0, y: s.targetDist }, s.bearing, o);
  const aimPt = aimToWorld({ x: Math.sin(s.aim) * s.targetDist, y: Math.cos(s.aim) * s.targetDist }, s.bearing, o);
  const line = (to, color, width, dash) => {
    const pts = [];
    for (let i = 0; i <= 30; i++) pts.push(cam.project({ x: o.x + (to.x - o.x) * (i / 30), y: o.y + (to.y - o.y) * (i / 30), z: 0 }));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    pathTo(ctx, pts); ctx.stroke(); ctx.setLineDash([]);
  };
  line(tgt, 'rgba(78,230,255,0.45)', 1.5, [3, 6]);
  line(aimPt, C.aim, 3, [14, 9]);

  if (s.showZone) zone(ctx, cam, s.path, s.params, s.bearing, o);
  if (s.showGhost && s.ghostPath) tracer(ctx, cam, s.ghostPath, s.bearing, o, s.progress, { ghost: true });
  tracer(ctx, cam, s.path, s.bearing, o, s.progress);

  ring(ctx, cam, tgt, 4, C.target);
  const aiming = Math.abs(s.aim) > 0.004;
  const aimLeft = s.aim < 0;
  pole(ctx, cam, tgt, C.target, `TARGET ${Math.round(s.targetDist)}`, aiming ? (aimLeft ? 'right' : 'left') : 'center');
  if (aiming) pole(ctx, cam, aimPt, C.aim, 'AIM', aimLeft ? 'left' : 'right');

  // Flight labels once the ball has passed them.
  const ap = cam.project(aimToWorld(s.path.apexPoint, s.bearing, o));
  if (ap && s.progress > 0.5) label(ctx, `${Math.round(s.params.apex * 3)} ft`, ap.x + 8, ap.y, { size: 14, align: 'left' });
  const lp = cam.project(aimToWorld(s.path.finish, s.bearing, o));
  const carry = { text: `${Math.round(s.params.carry)} carry`, color: C.label };
  const gp = s.showGhost && s.ghostPath ? cam.project(aimToWorld(s.ghostPath.finish, s.bearing, o)) : null;
  const below = (p) => p.y + 14;
  if (lp && gp && s.progress > 0.95) {
    sideBySide(ctx, { ...carry, p: lp }, { text: 'typical miss', color: 'rgba(255,255,255,0.85)', p: gp }, below);
  } else if (lp && s.progress > 0.86) {
    label(ctx, carry.text, lp.x, below(lp), { size: 13 });
  }
}
