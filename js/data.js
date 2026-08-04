// Mock data: routes, stops, drivers. Johannesburg-flavoured coordinates (approximate).
// Loaded as a plain script (no modules) so it works from file:// with no server.

// Bump this whenever routes/drivers shape changes — store.js uses it to
// throw away stale localStorage from a previous version instead of silently
// matching passengers against routes that no longer exist.
const DATA_VERSION = 2;

// All routes are centred on Auckland Park and its immediate surrounding
// suburbs (Melville, Milpark, Brixton, Braamfontein, Westdene, Emmarentia,
// Greenside, Rosebank, Randburg, Cresta) — kept deliberately local/walkable
// distances apart so the demo map stays tight and legible. APAX School is
// first in the list since it's the anchor for this assignment.
const MOCK_ROUTES = [
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
  {
    id: 'route-milpark-braamfontein',
    name: 'Auckland Park ↔ Milpark ↔ Brixton ↔ Braamfontein',
    stops: [
      { id: 'stop-auckland-park-2', name: 'Auckland Park', lat: -26.1848, lng: 28.0088 },
      { id: 'stop-milpark', name: 'Milpark', lat: -26.1790, lng: 28.0180 },
      { id: 'stop-brixton', name: 'Brixton', lat: -26.1740, lng: 28.0230 },
      { id: 'stop-braamfontein', name: 'Braamfontein', lat: -26.1925, lng: 28.0356 },
      { id: 'stop-parktown', name: 'Parktown', lat: -26.1830, lng: 28.0430 },
    ],
  },
  {
    id: 'route-emmarentia-rosebank',
    name: 'Auckland Park ↔ Emmarentia ↔ Greenside ↔ Rosebank',
    stops: [
      { id: 'stop-auckland-park-3', name: 'Auckland Park', lat: -26.1848, lng: 28.0088 },
      { id: 'stop-westdene', name: 'Westdene', lat: -26.1740, lng: 27.9970 },
      { id: 'stop-emmarentia', name: 'Emmarentia', lat: -26.1620, lng: 28.0000 },
      { id: 'stop-greenside', name: 'Greenside', lat: -26.1560, lng: 28.0210 },
      { id: 'stop-rosebank', name: 'Rosebank', lat: -26.1467, lng: 28.0436 },
    ],
  },
];

const MOCK_DRIVERS = [
  {
    id: 'driver-thabo',
    name: 'Thabo Nkosi',
    routeId: 'route-apax-randburg',
    currentLocation: { lat: -26.1800, lng: 28.0070 },
    status: 'online',
  },
  {
    id: 'driver-sipho',
    name: 'Sipho Dlamini',
    routeId: 'route-apax-randburg',
    currentLocation: { lat: -26.1050, lng: 27.9850 },
    status: 'online',
  },
  {
    id: 'driver-lerato',
    name: 'Lerato Mokoena',
    routeId: 'route-milpark-braamfontein',
    currentLocation: { lat: -26.1800, lng: 28.0200 },
    status: 'online',
  },
  {
    id: 'driver-zanele',
    name: 'Zanele Khumalo',
    routeId: 'route-emmarentia-rosebank',
    currentLocation: { lat: -26.1700, lng: 28.0050 },
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
