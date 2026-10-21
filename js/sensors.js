// Camera feed, device orientation and GPS. Must be started from a user gesture
// (iOS requires it for both the camera and DeviceOrientationEvent.requestPermission).

import { rotationFromEuler, viewAngles, rotateHeading } from './camera-math.js';

export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs HTTPS and a supported browser.');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

// Calls onRotation(R, {heading, accuracy}) with a north-referenced device→earth matrix.
export async function startOrientation(onRotation) {
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) throw new Error('This device has no orientation sensor.');
  if (typeof DOE.requestPermission === 'function') {
    const res = await DOE.requestPermission();
    if (res !== 'granted') throw new Error('Motion & orientation access was denied.');
  }

  let compassOffset = null; // iOS: alpha is not north-referenced; correct with webkitCompassHeading
  const handle = (e, absolute) => {
    if (e.alpha == null) return;
    let R = rotationFromEuler(e.alpha, e.beta, e.gamma);
    let accuracy = null;
    if (typeof e.webkitCompassHeading === 'number') {
      accuracy = e.webkitCompassAccuracy;
      const raw = ((e.webkitCompassHeading - viewAngles(R).heading + 540) % 360) - 180;
      // Circular low-pass on the offset so compass jitter doesn't shake the overlay.
      compassOffset = compassOffset == null ? raw : compassOffset + ((((raw - compassOffset) + 540) % 360) - 180) * 0.05;
      R = rotateHeading(R, compassOffset);
    } else if (!absolute && !e.absolute) {
      accuracy = -1; // relative only: heading won't match the real world
    }
    onRotation(R, { accuracy });
  };

  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', (e) => handle(e, true));
  } else {
    window.addEventListener('deviceorientation', (e) => handle(e, false));
  }
}

export function startGps(onFix) {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    (pos) => onFix({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
    () => onFix(null),
    { enableHighAccuracy: true, maximumAge: 2000 },
  );
}
