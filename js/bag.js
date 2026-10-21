// Default bag (mock dispersion data, RH ~14 handicap) and local persistence.
// bias: average lateral miss in yds (+ = right). latSD / carrySD: 1σ spread in yds.

export const DEFAULT_BAG = [
  { name: 'Driver',   short: 'DR', carry: 220, apexFt: 90, roll: 20, bias: 9,  latSD: 16, carrySD: 12 },
  { name: '3 Wood',   short: '3W', carry: 200, apexFt: 84, roll: 14, bias: 6,  latSD: 14, carrySD: 11 },
  { name: '4 Hybrid', short: '4H', carry: 182, apexFt: 80, roll: 9,  bias: 3,  latSD: 12, carrySD: 10 },
  { name: '5 Iron',   short: '5i', carry: 170, apexFt: 78, roll: 7,  bias: 4,  latSD: 11, carrySD: 9 },
  { name: '6 Iron',   short: '6i', carry: 160, apexFt: 77, roll: 6,  bias: 4,  latSD: 10, carrySD: 8 },
  { name: '7 Iron',   short: '7i', carry: 150, apexFt: 76, roll: 5,  bias: 5,  latSD: 9,  carrySD: 8 },
  { name: '8 Iron',   short: '8i', carry: 140, apexFt: 75, roll: 4,  bias: 3,  latSD: 8,  carrySD: 7 },
  { name: '9 Iron',   short: '9i', carry: 130, apexFt: 74, roll: 3,  bias: 2,  latSD: 7,  carrySD: 6 },
  { name: 'PW',       short: 'PW', carry: 118, apexFt: 72, roll: 2,  bias: 1,  latSD: 6,  carrySD: 5 },
  { name: 'GW',       short: 'GW', carry: 102, apexFt: 70, roll: 1,  bias: -1, latSD: 6,  carrySD: 5 },
  { name: 'SW',       short: 'SW', carry: 84,  apexFt: 66, roll: 1,  bias: -2, latSD: 5,  carrySD: 5 },
];

const KEY = 'aimline.v1';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage blocked: fall back to defaults */ }
  return null;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export const cloneBag = (bag) => bag.map((c) => ({ ...c }));
