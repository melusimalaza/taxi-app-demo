# Smart Taxi Tracking — Prototype (Science Expo Demo)

No backend, no database, no real auth — everything is mocked and lives in
your browser. Built from `taxi_app_prototype_spec.md` (Nadia's spec).

**Live demo:** https://melusimalaza.github.io/taxi-app-demo/ — works on any
phone or laptop, no local setup needed. Open the Passenger and Driver links
on two devices (or two tabs) to test the full flow.

## Run it

Any static file server works. Easiest options:

```bash
npx serve taxi-app-demo
```

or

```bash
python -m http.server 8123 --directory taxi-app-demo
```

Then open `http://localhost:8123`. (Opening `index.html` directly by
double-click also works in most browsers, but a local server avoids any
`file://` quirks with cross-tab syncing — recommended for the actual demo.)

## Demo flow

1. Open the **Passenger Portal** in one tab, **Driver Portal** in another.
2. On the Driver Portal, "log in" as one of the 4 pre-loaded drivers (or
   register a new one) and make sure you're **Online**.
3. On the Passenger Portal, log in, click the map to set your location, pick
   a route, pick a stop, and hit **Request Pickup**.
4. Watch it show up live on the driver tab with a synced 90s countdown.
   Accept it to see both sides confirm the match and the taxi icon animate
   toward the pickup point with an ETA.
5. To demo the decline/timeout path: Decline on the driver tab (or just let
   the 90s run out) — the passenger tab will automatically retry with the
   next-closest available driver on that route.

## How it works

- All mock data (routes, stops, drivers) lives in `js/data.js`.
- Shared state (drivers, requests) is persisted to the browser's
  `localStorage` and broadcast between tabs via the `storage` event — this
  is what makes the Passenger and Driver portals "talk" to each other with
  zero server. It's still 100% local to your machine.
- Login identity (which passenger/driver you are) is per-tab, via
  `sessionStorage`, so you can run multiple driver tabs as different people.
- Plain `<script>` includes, no bundler/build step — works from any static
  host or directly from disk.

## Design decisions made for the demo (flagged, not in the original spec)

- **Passenger and Driver are separate pages/tabs**, not a single shared
  screen, synced via `localStorage`. Chosen because it's more demo-realistic
  (two people, two "devices") than a single-screen mode switcher.
- **Johannesburg-flavoured mock coordinates** (Bree St, Park Station, Noord
  St ranks) — not real-world accurate, just plausible for local flavor.
- **Driver login** offers a quick "play as an existing mock driver" path
  (recommended for the live demo — location/route already set) plus a
  "register as a new driver" path that lets you click the map to set a
  location and pick a route from scratch, matching the spec's driver setup
  flow more literally.
- **Animation speed** is sped up relative to the displayed ETA so a ~10 min
  ETA doesn't mean waiting 10 real minutes during the demo.
