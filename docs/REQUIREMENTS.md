# AimLine — AR Shot Tracer & Aim Suggestion

Working name: **AimLine**. Point your phone down the hole and see the ball flight
you're about to hit, drawn over the real course, with an aim line adjusted for how
*you* actually miss.

## 1. Problem

Arccos and 18Birdies collect excellent per-club dispersion data, but neither turns it
into a "here's where to aim" suggestion, and both present it on a 2D overhead map.
Translating a top-down dispersion ellipse into "which tree on the horizon do I aim
at" is hard. Golfers think in 3D: start line, curve, height, where it lands.

## 2. Product vision

1. Stand on the tee (or in the fairway), raise the phone.
2. The camera view shows a **shot tracer** for the selected club: correct carry,
   apex height, curve and roll, anchored to the ground in front of you.
3. Pick a **target** (e.g. the corner of a dogleg right).
4. The app solves for an **aim line** using your dispersion bias ("you miss driver
   ~9 yds right, aim 2.5° left") and draws both the aim line and the expected flight.
5. Toggle **shot shapes** (hook, draw, straight, fade, slice) to preview what an
   intentional shape would look like and where it would end up.
6. See a **dispersion zone** on the ground (where 68% / 95% of your shots land) so
   you can tell whether trouble is in play.

## 3. Decisions made (2026-10-20)

| Topic | Decision |
|---|---|
| First platform | **iPhone** (ARKit is the long-term AR engine). |
| Dispersion data source | **Manual club entry** (carry, apex, roll, miss bias, spread). No public Arccos/18Birdies API exists. |
| Course geometry | **Pin target in AR** — user sets bearing + distance. No course database in v1. |
| First prototype | **Phone-browser AR demo** (camera + compass/tilt overlay), plus a simulated demo hole for desktop. |
| Dev machine | Windows → native iOS builds go through a cloud build service (Expo EAS) or a borrowed Mac. |

## 4. Users

- **Primary:** mid-handicap golfer (8–25) who already tracks shots with Arccos /
  18Birdies and knows their numbers but not how to apply them on the course.
- **Secondary:** low handicaps who want to visualise intentional shapes; coaches.

## 5. Functional requirements

### 5.1 Bag & dispersion profile (v1: manual)
- FR-1 User can create/edit a bag of up to 14 clubs.
- FR-2 Per club: name, carry (yds), apex height (ft), roll (yds), lateral bias
  (yds, + = right), lateral spread (1σ yds), carry spread (1σ yds), typical shape.
- FR-3 Handedness setting (RH/LH); LH mirrors all curve directions.
- FR-4 Ship a realistic default bag so the app works on first launch.
- FR-5 (later) Import from CSV; in-app shot logging that updates bias/spread.

### 5.2 Shot tracer
- FR-10 Draw a 3D ball flight from the ball position for the selected club using
  carry, apex, curve and roll.
- FR-11 Flight shape is realistic: apex at ~55–60% of carry, steeper descent than
  ascent, curve grows with distance.
- FR-12 Animated tracer (draw-on like a TV tracer), with a ground shadow for depth.
- FR-13 Club change updates height/length immediately.
- FR-14 Shot-shape selector: hook, draw, straight, fade, slice. Each changes curve,
  apex, carry and roll (e.g. draw = lower + more roll, slice = higher, shorter, less roll).

### 5.3 Target & aim suggestion
- FR-20 User sets a target bearing by pointing the phone and tapping "Set target".
- FR-21 Target distance defaults to the club's total distance, adjustable with a slider.
- FR-22 App solves the aim angle so the *expected* ball (shape + personal bias)
  finishes on the target line.
- FR-23 Show the aim line, the expected flight, and (optional) a ghost of the
  "typical miss" if the golfer aimed straight at the target.
- FR-24 Plain-language suggestion: "You miss 7-iron 6 yds right. Aim 2° left
  (~5 yds left of the flag)."
- FR-25 Club suggestion when target distance doesn't fit the selected club (>10 yds off).

### 5.4 Dispersion visualisation
- FR-30 Ground-projected 1σ and 2σ ellipses at the expected landing point, oriented
  along the flight direction.

### 5.5 Sensors & AR
- FR-40 Live rear camera feed as background.
- FR-41 Device orientation (compass heading, pitch, roll) drives a virtual camera so
  overlays stay locked to the world as the phone moves.
- FR-42 GPS fix shown; tee position stored with each target (prep for course data).
- FR-43 FOV and eye-height calibration in settings.
- FR-44 Simulated demo hole (dogleg right) when no camera/sensors are available.
- FR-45 (native) ARKit world tracking + plane detection replaces compass-only
  tracking for rock-solid anchoring; geo-anchors where available.

### 5.6 Later phases
- Wind (speed/direction) and elevation change ("plays like" distance).
- Course database (fairway/hazard polygons) so suggestions avoid trouble and pick the
  target that minimises expected strokes.
- Strokes-gained style target optimisation over the dispersion ellipse.
- Apple Watch quick club switch; shot logging to refine the profile.

## 6. Non-functional requirements

- NFR-1 Overlay update ≥ 30 fps; sensor-to-render latency < 50 ms.
- NFR-2 Heading drift handled with smoothing; recalibration prompt if compass accuracy is poor.
- NFR-3 Works in bright sunlight: high-contrast tracer colours, large touch targets
  (≥ 44 pt), usable one-handed.
- NFR-4 Offline-capable; bag stored locally on device. No account required for v1.
- NFR-5 Battery: camera/AR only active on the aim screen; auto-pause after 60 s idle.
- NFR-6 Rules of golf: device distance/advice features are allowed in casual play;
  some features (club advice, "plays like") are not allowed in competition. Provide a
  "tournament mode" toggle that hides suggestions (later).

## 7. Shot model (prototype)

All units yards unless noted; `u` = fraction of carry (0 → 1).

- Height: `h(u) = apex · u^a (1−u)^b / (up^a (1−up)^b)` with `a=1.15, b=0.85`
  → apex at `up = a/(a+b) ≈ 0.575`, steeper descent.
- Lateral: `x(u) = curve · u²` (curve = shape curve + personal bias).
- Roll: continues along the landing tangent for `roll` yards.
- Shape modifiers (fraction of carry for curve):

| Shape | Curve | Apex × | Carry × | Roll × |
|---|---|---|---|---|
| Hook | −11% | 0.82 | 0.96 | 1.6 |
| Draw | −4% | 0.93 | 1.00 | 1.25 |
| Straight | 0 | 1.00 | 1.00 | 1.0 |
| Fade | +4% | 1.06 | 0.98 | 0.8 |
| Slice | +11% | 1.10 | 0.90 | 0.6 |

- Aim solve: simulate with aim = 0, read finish point `(xf, yf)`; aim offset =
  `−atan2(xf, yf)` applied around the ball, so the expected finish lies on the target line.

## 8. Mock data (default bag, RH, ~14 handicap)

| Club | Carry | Apex ft | Roll | Bias (yds, +R) | Lat σ | Carry σ |
|---|---|---|---|---|---|---|
| Driver | 220 | 90 | 20 | +9 | 16 | 12 |
| 3 Wood | 200 | 84 | 14 | +6 | 14 | 11 |
| 4 Hybrid | 182 | 80 | 9 | +3 | 12 | 10 |
| 5 Iron | 170 | 78 | 7 | +4 | 11 | 9 |
| 6 Iron | 160 | 77 | 6 | +4 | 10 | 8 |
| 7 Iron | 150 | 76 | 5 | +5 | 9 | 8 |
| 8 Iron | 140 | 75 | 4 | +3 | 8 | 7 |
| 9 Iron | 130 | 74 | 3 | +2 | 7 | 6 |
| PW | 118 | 72 | 2 | +1 | 6 | 5 |
| GW | 102 | 70 | 1 | −1 | 6 | 5 |
| SW | 84 | 66 | 1 | −2 | 5 | 5 |

## 9. Roadmap

| Phase | Deliverable | Status |
|---|---|---|
| 0 | Requirements + web AR prototype with mock data (`prototype/`) | ✅ this pass |
| 1 | Deployable web prototype on HTTPS (open on iPhone Safari, test on a real tee) | next |
| 2 | Expo (React Native) app: camera + sensor overlay ported from the prototype, bag editor, local storage. Built in the cloud with EAS, installed via TestFlight | |
| 3 | ARKit world tracking (ViroReact or a native Swift module) for stable anchoring | |
| 4 | Course data, wind/elevation, target optimisation, shot logging | |

## 10. Open questions

1. Do you want target distance to mean **where the ball stops** (default) or **where it lands** (carry)? Matters most for approach shots.
2. Should the expected tracer include your bias by default, or show the "pure" shot and the bias only as the suggestion?
3. How much do you trust compass accuracy on course? Native ARKit fixes drift but needs a short "scan the ground" step. OK with that?
4. Is there a sample Arccos / 18Birdies export you can grab (screenshot or CSV) so we can design the import later?
5. App Store eventually, or TestFlight / personal use only? (Decides whether we need privacy policy, onboarding, accounts.)
6. Wind: manual input, or pull from a weather API by GPS?
