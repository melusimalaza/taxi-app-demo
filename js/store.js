// Shared state, now backed by Firebase Realtime Database instead of
// localStorage — this is what lets the Passenger and Driver portals sync
// across two different phones/devices over the internet, not just two tabs
// on the same browser.
//
// Public API is unchanged on purpose (loadState/updateState/subscribeStore)
// so passenger.js and driver.js didn't need to change at all: loadState()
// still reads synchronously from an in-memory cache, updateState() still
// applies its mutator immediately (optimistic local update) so the calling
// code can read its own write right away, and the Firebase write happens
// in the background as a transaction — Firebase retries it automatically
// if another device wrote at the same time, which is stronger correctness
// than the old localStorage read-modify-write ever had.

const DB_PATH = 'taxiDemoState';
const dbRef = firebase.database().ref(DB_PATH);

function seedState() {
  return {
    version: DATA_VERSION,
    routes: MOCK_ROUTES,
    drivers: MOCK_DRIVERS.map((d) => ({ ...d })),
    requests: [], // full history, most recent last
  };
}

let cachedState = seedState(); // placeholder until the first snapshot arrives
let firstSnapshotReceived = false;

// Firebase RTDB silently drops empty arrays/objects on write (a `[]` comes
// back as `undefined`, not `[]`), so every read needs to backfill them.
function normalizeState(data) {
  return {
    version: data.version,
    routes: data.routes || [],
    drivers: data.drivers || [],
    requests: data.requests || [],
  };
}

dbRef.on('value', (snapshot) => {
  const data = snapshot.val();
  if (!data || data.version !== DATA_VERSION) {
    // Empty DB, or an older client's data shape — reseed for everyone.
    const seeded = seedState();
    dbRef.set(seeded);
    cachedState = seeded;
  } else {
    cachedState = normalizeState(data);
  }
  firstSnapshotReceived = true;
  window.dispatchEvent(new CustomEvent('taxi-store-changed', { detail: cachedState }));
});

function loadState() {
  return cachedState;
}

function saveStateLocally(state) {
  cachedState = state;
  window.dispatchEvent(new CustomEvent('taxi-store-changed', { detail: state }));
}

function resetDemoData() {
  const seeded = seedState();
  saveStateLocally(seeded);
  dbRef.set(seeded);
  return seeded;
}

// Subscribe to changes, whether they came from this tab or another
// device entirely. Calls back with the fresh state.
function subscribeStore(callback) {
  const onLocal = (e) => callback(e.detail);
  window.addEventListener('taxi-store-changed', onLocal);
  return () => window.removeEventListener('taxi-store-changed', onLocal);
}

// Applies `mutator` optimistically to the local cache (so the caller's next
// loadState() sees it immediately, same as before), then pushes it to
// Firebase as a transaction in the background. If another device wrote in
// the meantime, Firebase re-runs the mutator against the latest server
// value and retries — no lost updates under concurrent requests.
function updateState(mutator) {
  const optimistic = JSON.parse(JSON.stringify(cachedState));
  mutator(optimistic);
  saveStateLocally(optimistic);

  dbRef.transaction((current) => {
    const draft = current && current.version === DATA_VERSION ? normalizeState(current) : seedState();
    mutator(draft);
    return draft;
  });

  return optimistic;
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

// Finds the closest available (online, matching route, not yet tried, not
// already sitting on someone else's pending request) driver.
function findClosestDriver(state, routeId, fromLocation, excludeDriverIds) {
  const busyDriverIds = new Set(
    state.requests.filter((r) => r.status === 'pending').map((r) => r.driverId)
  );
  const candidates = state.drivers.filter(
    (d) =>
      d.routeId === routeId &&
      d.status === 'online' &&
      !excludeDriverIds.includes(d.id) &&
      !busyDriverIds.has(d.id)
  );
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      distanceKm(fromLocation, a.currentLocation) -
      distanceKm(fromLocation, b.currentLocation)
  );
  return candidates[0];
}
