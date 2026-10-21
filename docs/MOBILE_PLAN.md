# Mobile app plan (iPhone first, from a Windows PC)

## Stack recommendation

**Expo (React Native) + EAS Build**, because:

- You're on Windows. Native iOS builds need Xcode on a Mac; Expo's EAS Build compiles in
  the cloud and pushes to TestFlight, so no Mac is required.
- The prototype's `shot-model.js` and `camera-math.js` are plain JS and drop in unchanged.
- Android comes almost free later.

| Concern | Library |
|---|---|
| Camera feed | `react-native-vision-camera` |
| Orientation / compass | `expo-sensors` (DeviceMotion) + `expo-location` (heading) |
| GPS | `expo-location` |
| Overlay drawing | `@shopify/react-native-skia` (same canvas-style API as the prototype renderer) |
| Storage | `@react-native-async-storage/async-storage` (bag), later SQLite for shot logs |
| AR world tracking (phase 3) | `@reactvision/react-viro` (ARKit/ARCore), or a small native Swift module with ARKit `ARGeoTrackingConfiguration` |

## Steps

1. **Accounts:** Apple Developer Program ($99/yr) and a free Expo account.
2. **Scaffold:** `npx create-expo-app aimline-app`, add the libraries above, use a
   development build (not Expo Go) because VisionCamera and Viro need native code.
3. **Port:** copy `shot-model.js`, `bag.js`, `camera-math.js`; rewrite `renderer.js` against
   Skia; rebuild the HUD/controls in React Native components.
4. **Build:** `eas build -p ios --profile preview`, install via TestFlight.
5. **Field test** on a real tee, tune FOV/eye-height calibration and smoothing.
6. **Phase 3:** swap compass tracking for ARKit world tracking so the tracer stays
   locked to the ground when you move the phone.

## Must-haves before App Store

- Privacy policy (camera + location usage strings).
- Onboarding: bag setup from Arccos/18Birdies numbers.
- Tournament-mode toggle (hide club/aim advice).
