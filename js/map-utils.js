// Small Leaflet helpers shared by passenger.js and driver.js.

function makeEmojiIcon(emoji, bg) {
  return L.divIcon({
    className: 'taxi-emoji-icon',
    html: `<div style="
      font-size:20px;
      width:34px;height:34px;
      display:flex;align-items:center;justify-content:center;
      background:${bg};
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    ">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

const ICONS = {
  passenger: () => makeEmojiIcon('🧍', '#2563eb'),
  driverOnline: () => makeEmojiIcon('🚕', '#0f7b52'),
  driverOffline: () => makeEmojiIcon('🚕', '#9aa39e'),
  driverMatched: () => makeEmojiIcon('🚕', '#c98a00'),
  stop: () => makeEmojiIcon('📍', '#6b7a75'),
};

function estimateEtaMinutes(km, speedKmh = 28) {
  return Math.max(1, Math.round((km / speedKmh) * 60));
}

// Animates a Leaflet marker in a straight line from `from` to `to` over
// `durationMs`, calling onTick(progress 0..1) each frame and onDone() at end.
// Returns a cancel() function.
function animateMarker(marker, from, to, durationMs, onTick, onDone) {
  const start = performance.now();
  let raf = null;
  function frame(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;
    marker.setLatLng([lat, lng]);
    if (onTick) onTick(t);
    if (t < 1) {
      raf = requestAnimationFrame(frame);
    } else if (onDone) {
      onDone();
    }
  }
  raf = requestAnimationFrame(frame);
  return () => { if (raf) cancelAnimationFrame(raf); };
}
