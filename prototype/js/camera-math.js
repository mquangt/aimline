// Virtual camera driven by W3C DeviceOrientation angles.
// World frame: ENU — x = east, y = north, z = up (yards). Device frame: x = screen
// right, y = screen top, z = out of the screen toward the user. The rear camera
// looks along device −z.

const D2R = Math.PI / 180;

// Device→earth rotation matrix (rows) for alpha/beta/gamma in degrees (Z-X'-Y'').
export function rotationFromEuler(alpha, beta, gamma) {
  const a = alpha * D2R, b = beta * D2R, g = gamma * D2R;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  return [
    [cA * cG - sA * sB * sG, -cB * sA, cA * sG + cG * sA * sB],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG],
  ];
}

// Phone held upright facing `heading` (deg, clockwise from north), tilted up `pitch` deg.
export const rotationFromHeadingPitch = (heading, pitch) => rotationFromEuler(-heading, 90 + pitch, 0);

// Compass heading (deg) and pitch of the camera's view direction.
export function viewAngles(R) {
  const dx = -R[0][2], dy = -R[1][2], dz = -R[2][2];
  const heading = (Math.atan2(dx, dy) / D2R + 360) % 360;
  const pitch = Math.asin(Math.max(-1, Math.min(1, dz))) / D2R;
  return { heading, pitch };
}

// Rotate a matrix about world up by `deg` (clockwise from above = heading increase).
export function rotateHeading(R, deg) {
  const t = -deg * D2R, c = Math.cos(t), s = Math.sin(t);
  return [
    [c * R[0][0] - s * R[1][0], c * R[0][1] - s * R[1][1], c * R[0][2] - s * R[1][2]],
    [s * R[0][0] + c * R[1][0], s * R[0][1] + c * R[1][1], s * R[0][2] + c * R[1][2]],
    R[2].slice(),
  ];
}

// Low-pass two rotation matrices and re-orthonormalise. Smoothing the matrix (not
// the Euler angles) avoids the gimbal flip at beta = 90°, i.e. a phone held upright.
export function smoothRotation(prev, next, k) {
  if (!prev) return next;
  const col = (M, j) => [M[0][j], M[1][j], M[2][j]];
  const mix = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
  const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const y = norm(mix(col(prev, 1), col(next, 1)));
  let z = mix(col(prev, 2), col(next, 2));
  const d = dot(z, y);
  z = norm(z.map((v, i) => v - d * y[i]));
  const x = cross(y, z);
  return [0, 1, 2].map((i) => [x[i], y[i], z[i]]);
}

export class Camera {
  constructor() {
    this.R = rotationFromHeadingPitch(0, -4);
    this.pos = { x: 0, y: -2, z: 1.75 };
    this.width = 1; this.height = 1;
    this.vfov = 70; // long-side FOV of a phone 1x camera (portrait vertical), deg
    this.screenAngle = 0; // screen.orientation.angle
    this.near = 0.5;
  }

  get focal() { return (this.height / 2) / Math.tan((this.vfov * D2R) / 2); }

  // World point → camera space {x: right, y: up, d: depth}.
  toCamera(p) {
    const dx = p.x - this.pos.x, dy = p.y - this.pos.y, dz = (p.z ?? 0) - this.pos.z;
    const R = this.R;
    const cx = R[0][0] * dx + R[1][0] * dy + R[2][0] * dz;
    const cy = R[0][1] * dx + R[1][1] * dy + R[2][1] * dz;
    const cz = R[0][2] * dx + R[1][2] * dy + R[2][2] * dz;
    const a = this.screenAngle * D2R, c = Math.cos(a), s = Math.sin(a);
    return { x: cx * c + cy * s, y: -cx * s + cy * c, d: -cz };
  }

  cameraToScreen(c) {
    const f = this.focal;
    return { x: this.width / 2 + (f * c.x) / c.d, y: this.height / 2 - (f * c.y) / c.d, d: c.d };
  }

  project(p) {
    const c = this.toCamera(p);
    return c.d < this.near ? null : this.cameraToScreen(c);
  }

  // Screen pixel → world-space ray direction.
  rayAt(sx, sy) {
    const f = this.focal;
    const xs = (sx - this.width / 2) / f, ys = -(sy - this.height / 2) / f;
    const a = this.screenAngle * D2R, c = Math.cos(a), s = Math.sin(a);
    const dev = [xs * c - ys * s, xs * s + ys * c, -1];
    const R = this.R;
    return [0, 1, 2].map((i) => R[i][0] * dev[0] + R[i][1] * dev[1] + R[i][2] * dev[2]);
  }

  // Screen pixel → world point on the ground (z = 0), or null if above the horizon.
  groundAt(sx, sy) {
    const w = this.rayAt(sx, sy);
    if (w[2] >= -1e-4) return null;
    const t = -this.pos.z / w[2];
    return { x: this.pos.x + w[0] * t, y: this.pos.y + w[1] * t, z: 0 };
  }

  // Project a ground polygon, clipped against the near plane (Sutherland–Hodgman).
  projectPolygon(points) {
    const cam = points.map((p) => this.toCamera(p));
    const out = [];
    for (let i = 0; i < cam.length; i++) {
      const a = cam[i], b = cam[(i + 1) % cam.length];
      const ain = a.d >= this.near, bin = b.d >= this.near;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (this.near - a.d) / (b.d - a.d);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, d: this.near });
      }
    }
    return out.map((c) => this.cameraToScreen(c));
  }
}

// Aim-frame point (x right, y downrange) → world, for a shot along `bearing` deg.
export function aimToWorld(p, bearing, origin = { x: 0, y: 0 }) {
  const b = bearing * D2R, s = Math.sin(b), c = Math.cos(b);
  return { x: origin.x + p.x * c + p.y * s, y: origin.y - p.x * s + p.y * c, z: p.z ?? 0 };
}
