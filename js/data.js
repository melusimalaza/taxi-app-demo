// Mock data: routes, stops, drivers. Johannesburg-flavoured coordinates (approximate).
// Loaded as a plain script (no modules) so it works from file:// with no server.

const MOCK_ROUTES = [
  {
    id: 'route-bree-baragwanath',
    name: 'Bree St ↔ Baragwanath (Soweto)',
    stops: [
      { id: 'stop-bree', name: 'Bree Street Taxi Rank', lat: -26.2023, lng: 28.0436 },
      { id: 'stop-nasrec', name: 'Nasrec', lat: -26.2385, lng: 27.9836 },
      { id: 'stop-baragwanath', name: 'Baragwanath', lat: -26.2519, lng: 27.9364 },
      { id: 'stop-orlando', name: 'Orlando', lat: -26.2635, lng: 27.9219 },
      { id: 'stop-dobsonville', name: 'Dobsonville', lat: -26.2544, lng: 27.8618 },
    ],
  },
  {
    id: 'route-park-sandton',
    name: 'Park Station ↔ Alexandra ↔ Sandton',
    stops: [
      { id: 'stop-park', name: 'Park Station', lat: -26.1919, lng: 28.0423 },
      { id: 'stop-wynberg', name: 'Wynberg', lat: -26.1058, lng: 28.0827 },
      { id: 'stop-marlboro', name: 'Marlboro', lat: -26.0891, lng: 28.1042 },
      { id: 'stop-alexandra', name: 'Alexandra', lat: -26.1030, lng: 28.0940 },
      { id: 'stop-sandton', name: 'Sandton', lat: -26.1076, lng: 28.0567 },
    ],
  },
  {
    id: 'route-apax-randburg',
    name: 'APAX School (Auckland Park) ↔ Melville ↔ Randburg',
    stops: [
      { id: 'stop-apax', name: 'APAX School, Auckland Park', lat: -26.1825, lng: 28.0125 },
      { id: 'stop-auckland-park', name: 'Auckland Park', lat: -26.1848, lng: 28.0088 },
      { id: 'stop-melville', name: 'Melville', lat: -26.1783, lng: 28.0028 },
      { id: 'stop-randburg', name: 'Randburg CBD', lat: -26.0939, lng: 27.9995 },
      { id: 'stop-cresta', name: 'Cresta', lat: -26.1177, lng: 27.9744 },
    ],
  },
];

const MOCK_DRIVERS = [
  {
    id: 'driver-thabo',
    name: 'Thabo Nkosi',
    routeId: 'route-bree-baragwanath',
    currentLocation: { lat: -26.2200, lng: 28.0100 },
    status: 'online',
  },
  {
    id: 'driver-sipho',
    name: 'Sipho Dlamini',
    routeId: 'route-bree-baragwanath',
    currentLocation: { lat: -26.2600, lng: 27.9300 },
    status: 'online',
  },
  {
    id: 'driver-lerato',
    name: 'Lerato Mokoena',
    routeId: 'route-park-sandton',
    currentLocation: { lat: -26.1050, lng: 28.0850 },
    status: 'online',
  },
  {
    id: 'driver-zanele',
    name: 'Zanele Khumalo',
    routeId: 'route-apax-randburg',
    currentLocation: { lat: -26.1830, lng: 28.0050 },
    status: 'online',
  },
];

const REQUEST_TIMEOUT_MS = 90 * 1000;

// Haversine distance in km.
function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function findRoute(routeId) {
  return MOCK_ROUTES.find((r) => r.id === routeId) || null;
}

function findStop(routeId, stopId) {
  const route = findRoute(routeId);
  if (!route) return null;
  return route.stops.find((s) => s.id === stopId) || null;
}
