# AimLine

AR shot tracer + aim suggestion from your own dispersion data.
See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for the spec and [docs/MOBILE_PLAN.md](docs/MOBILE_PLAN.md) for the path to a phone app.

## Prototype (phone-browser AR)

```
prototype/
  index.html, styles.css
  js/shot-model.js   pure ball-flight + aim solve (ports to the mobile app as-is)
  js/bag.js          sample bag (mock dispersion data) + local storage
  js/camera-math.js  device orientation -> virtual camera, projection, ground raycast
  js/sensors.js      camera feed, compass/tilt, GPS
  js/course.js       mock dogleg-right hole for demo mode
  js/renderer.js     canvas overlay: tracer, aim line, target, landing zone
  js/app.js          state + UI wiring
  tests/             node:test unit tests for the shot model
```

Run locally (Node 18+, no dependencies):

```bash
npm run dev
```

Open http://localhost:5173 and pick **Try the demo hole**: drag to look around, tap the ground to set a target, toggle **Eye level / Drone** in the top bar.

```bash
npm test
```

### On your iPhone

Live build (HTTPS, GitHub Pages): **https://mquangt.github.io/aimline/**

Camera and motion sensors only work over HTTPS. To publish changes, commit them and run `npm run deploy`: it pushes `main`, then pushes the `prototype/` folder to the `gh-pages` branch, and Pages rebuilds in about a minute.

On the phone: tap **Start camera AR**, allow Motion & Orientation and the camera, stand behind your ball, point at your target and tap **Set target here**. Set the distance with the slider. Calibrate in the bag menu (sliders icon) if the tracer doesn't line up with the real horizon: **Camera FOV** scales the overlay, **Eye height** moves the ground.

Known prototype limits: compass-only tracking (it drifts and jitters near metal/carts), flat ground assumed, no wind, portrait only tested.
