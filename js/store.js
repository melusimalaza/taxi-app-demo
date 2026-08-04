// Shared in-memory-ish state, persisted to localStorage so the Passenger and
// Driver portals (separate browser tabs/windows) can see each other's changes
// with no backend. This is still "no database" — localStorage is client-side
// browser storage, cleared any time you clear demo data.

const STORE_KEY = 'umaliTaxiDemoState_v1';

function seedState() {
  return {
    routes: MOCK_ROUTES,
    drivers: MOCK_DRIVERS.map((d) => ({ ...d })),
    requests: [], // full history, most recent last
  };
}

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    const seeded = seedState();
    localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const seeded = seedState();
    localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  // storage event only fires in OTHER tabs, not this one, so notify local
  // listeners (same-tab UI) directly too.
  window.dispatchEvent(new CustomEvent('taxi-store-changed', { detail: state }));
}

function resetDemoData() {
  const seeded = seedState();
  saveState(seeded);
  return seeded;
}

// Subscribe to changes from any tab. Calls back with the fresh state.
function subscribeStore(callback) {
  const onStorage = (e) => {
    if (e.key === STORE_KEY) callback(loadState());
  };
  const onLocal = (e) => callback(e.detail);
  window.addEventListener('storage', onStorage);
  window.addEventListener('taxi-store-changed', onLocal);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('taxi-store-changed', onLocal);
  };
}

function updateState(mutator) {
  const state = loadState();
  mutator(state);
  saveState(state);
  return state;
}

function getDriver(state, driverId) {
  return state.drivers.find((d) => d.id === driverId) || null;
}

function getActiveRequestForDriver(state, driverId) {
  return (
    state.requests.find(
      (r) => r.driverId === driverId && r.status === 'pending'
    ) || null
  );
}

function getLatestRequestForPassenger(state, passengerId) {
  const mine = state.requests.filter((r) => r.passengerId === passengerId);
  return mine.length ? mine[mine.length - 1] : null;
}

// Finds the closest available (online, matching route, not yet tried) driver.
function findClosestDriver(state, routeId, fromLocation, excludeDriverIds) {
  const candidates = state.drivers.filter(
    (d) =>
      d.routeId === routeId &&
      d.status === 'online' &&
      !excludeDriverIds.includes(d.id)
  );
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      distanceKm(fromLocation, a.currentLocation) -
      distanceKm(fromLocation, b.currentLocation)
  );
  return candidates[0];
}
