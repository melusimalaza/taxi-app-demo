(function () {
  const JHB_CENTER = { lat: -26.1900, lng: 28.0000 };

  let passengerId = sessionStorage.getItem('taxiPassengerId');
  if (!passengerId) {
    passengerId = 'passenger-' + Math.random().toString(36).slice(2, 9);
    sessionStorage.setItem('taxiPassengerId', passengerId);
  }
  let passengerName = sessionStorage.getItem('taxiPassengerName') || '';

  let map, passengerMarker, routeLine;
  const driverMarkers = {}; // driverId -> marker
  let pickupMarker = null;

  let selectedRouteId = null;
  let selectedStopId = null;
  let passengerLocation = { ...JHB_CENTER };

  let activeRequestId = null; // request currently being tracked
  let handledExpiryFor = new Set(); // request ids we've already forwarded
  let animCancel = null;
  let animatingForRequestId = null;

  // ---------- STEP 1: login ----------
  const nameInput = document.getElementById('passenger-name');
  const btnLogin = document.getElementById('btn-login');
  const welcomeTag = document.getElementById('welcome-tag');

  if (passengerName) {
    nameInput.value = passengerName;
  }

  btnLogin.addEventListener('click', () => {
    const val = nameInput.value.trim();
    if (!val) {
      nameInput.focus();
      return;
    }
    passengerName = val;
    sessionStorage.setItem('taxiPassengerName', passengerName);
    document.getElementById('panel-login').style.display = 'none';
    document.getElementById('panel-setup').style.display = 'block';
    welcomeTag.textContent = `Logged in as ${passengerName}`;
    initMap();
    populateRoutes();
    refreshRequestBlocker();
  });

  // ---------- STEP 2: location / route / stop ----------
  function initMap() {
    map = L.map('map').setView([JHB_CENTER.lat, JHB_CENTER.lng], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    passengerMarker = L.marker([passengerLocation.lat, passengerLocation.lng], {
      icon: ICONS.passenger(),
      draggable: true,
    }).addTo(map).bindPopup('You');

    map.on('click', (e) => setPassengerLocation(e.latlng.lat, e.latlng.lng));
    passengerMarker.on('dragend', () => {
      const p = passengerMarker.getLatLng();
      setPassengerLocation(p.lat, p.lng, false);
    });
  }

  function setPassengerLocation(lat, lng, moveMarker = true) {
    passengerLocation = { lat, lng };
    if (moveMarker) passengerMarker.setLatLng([lat, lng]);
    document.getElementById('location-info').textContent =
      `📍 Location set (${lat.toFixed(4)}, ${lng.toFixed(4)}). Tap again to move it.`;
    if (selectedRouteId) { renderStopList(); renderDriverPreview(); }
    refreshRequestBlocker();
  }

  function refreshRequestBlocker() {
    const btn = document.getElementById('btn-request');
    const blocker = document.getElementById('request-blocker');
    const missing = [];
    if (!selectedRouteId) missing.push('a route');
    if (selectedRouteId && !selectedStopId) missing.push('a pickup stop');
    btn.disabled = missing.length > 0;
    blocker.textContent = missing.length ? `Still needed: ${missing.join(', ')}.` : 'Ready to request!';
  }

  function populateRoutes() {
    const sel = document.getElementById('route-select');
    MOCK_ROUTES.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      selectedRouteId = sel.value || null;
      selectedStopId = null;
      const routeInfo = document.getElementById('route-info');
      if (!selectedRouteId) {
        document.getElementById('stop-picker').style.display = 'none';
        document.getElementById('driver-preview').style.display = 'none';
        clearRouteLine();
        clearDriverMarkers();
        routeInfo.textContent = 'Pick a route to see its stops and nearby taxis.';
        refreshRequestBlocker();
        return;
      }
      const route = findRoute(selectedRouteId);
      routeInfo.textContent = `${route.name}: ${route.stops.length} stops shown below and on the map.`;
      document.getElementById('stop-picker').style.display = 'block';
      document.getElementById('driver-preview').style.display = 'block';
      drawRouteLine();
      renderStopList();
      renderDriverPreview();
    });
  }

  function clearRouteLine() {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  }

  function drawRouteLine() {
    clearRouteLine();
    const route = findRoute(selectedRouteId);
    const latlngs = route.stops.map((s) => [s.lat, s.lng]);
    routeLine = L.polyline(latlngs, { color: '#0f7b52', weight: 3, opacity: 0.6 }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
  }

  function renderStopList() {
    const route = findRoute(selectedRouteId);
    const list = document.getElementById('stop-list');
    list.innerHTML = '';
    const sorted = [...route.stops].sort(
      (a, b) => distanceKm(passengerLocation, a) - distanceKm(passengerLocation, b)
    );
    sorted.forEach((stop, i) => {
      const li = document.createElement('li');
      const km = distanceKm(passengerLocation, stop).toFixed(1);
      li.innerHTML = `<span>${stop.name}</span><span class="dist">${km} km</span>`;
      if (i === 0 && !selectedStopId) selectedStopId = stop.id;
      if (stop.id === selectedStopId) li.classList.add('selected');
      li.addEventListener('click', () => {
        selectedStopId = stop.id;
        renderStopList();
        renderPickupMarker();
      });
      list.appendChild(li);
    });
    renderPickupMarker();
    refreshRequestBlocker();
  }

  function renderPickupMarker() {
    if (pickupMarker) { map.removeLayer(pickupMarker); pickupMarker = null; }
    const stop = findStop(selectedRouteId, selectedStopId);
    if (!stop) return;
    pickupMarker = L.marker([stop.lat, stop.lng], { icon: ICONS.stop() })
      .addTo(map)
      .bindPopup(`Pickup: ${stop.name}`);
  }

  function clearDriverMarkers() {
    Object.values(driverMarkers).forEach((m) => map.removeLayer(m));
    for (const k in driverMarkers) delete driverMarkers[k];
  }

  function renderDriverPreview() {
    const state = loadState();
    const list = document.getElementById('driver-list');
    list.innerHTML = '';
    clearDriverMarkers();
    const drivers = state.drivers.filter(
      (d) => d.routeId === selectedRouteId && d.status !== 'offline'
    );
    if (!drivers.length) {
      list.innerHTML = '<li>No drivers currently available on this route.</li>';
      return;
    }
    drivers
      .sort((a, b) => distanceKm(passengerLocation, a.currentLocation) - distanceKm(passengerLocation, b.currentLocation))
      .forEach((d) => {
        const li = document.createElement('li');
        const km = distanceKm(passengerLocation, d.currentLocation).toFixed(1);
        li.innerHTML = `<span>🚕 ${d.name}</span><span class="dist">${km} km</span>`;
        list.appendChild(li);

        const marker = L.marker([d.currentLocation.lat, d.currentLocation.lng], {
          icon: ICONS.driverOnline(),
        }).addTo(map).bindPopup(d.name);
        driverMarkers[d.id] = marker;
      });
  }

  document.getElementById('btn-request').addEventListener('click', sendRequest);

  function sendRequest() {
    const state = loadState();
    const stop = findStop(selectedRouteId, selectedStopId);
    const driver = findClosestDriver(state, selectedRouteId, passengerLocation, []);
    document.getElementById('panel-status').style.display = 'block';
    document.getElementById('btn-request').disabled = true;

    if (!driver) {
      renderNoDrivers();
      return;
    }

    const req = {
      id: 'req-' + Math.random().toString(36).slice(2, 9),
      passengerId,
      passengerName,
      passengerLocation: { ...passengerLocation },
      routeId: selectedRouteId,
      stopId: selectedStopId,
      driverId: driver.id,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + REQUEST_TIMEOUT_MS,
      triedDriverIds: [driver.id],
    };
    updateState((s) => { s.requests.push(req); });
    activeRequestId = req.id;
    startPolling();
  }

  function renderNoDrivers() {
    setStatusChip('declined', 'No drivers available');
    document.getElementById('status-detail').innerHTML =
      '<p>No online drivers on this route right now. Try again once a driver goes online.</p>';
    document.getElementById('btn-reset').style.display = 'inline-block';
  }

  // ---------- STEP 3: status / polling / forwarding ----------
  function setStatusChip(kind, label) {
    const chip = document.getElementById('status-chip');
    chip.className = 'status-chip status-' + kind;
    document.getElementById('status-text').textContent = label;
  }

  function getMyLatestRequest() {
    const state = loadState();
    return getLatestRequestForPassenger(state, passengerId);
  }

  let pollHandle = null;
  function startPolling() {
    setStatusChip('waiting', 'Request sent — waiting…');
    tick();
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = setInterval(tick, 400);
    const unsub = subscribeStore(() => tick());
  }

  function tick() {
    const req = getMyLatestRequest();
    if (!req) return;
    const now = Date.now();

    if (req.status === 'accepted') {
      renderAccepted(req);
      return;
    }

    if (req.status === 'declined' || (req.status === 'pending' && now > req.expiresAt)) {
      handleDeclineOrTimeout(req);
      return;
    }

    // still pending
    const secsLeft = Math.max(0, Math.ceil((req.expiresAt - now) / 1000));
    const driver = loadState().drivers.find((d) => d.id === req.driverId);
    setStatusChip('waiting', `Request sent — waiting (${secsLeft}s)`);
    document.getElementById('status-detail').innerHTML = `
      <p>Waiting for <strong>${driver ? driver.name : 'driver'}</strong> to respond.</p>
      <p class="timer-ring">${secsLeft}s remaining</p>
    `;
  }

  function handleDeclineOrTimeout(req) {
    if (handledExpiryFor.has(req.id)) return;
    handledExpiryFor.add(req.id);

    // mark old request terminal if it timed out (driver decline already sets this)
    updateState((s) => {
      const stored = s.requests.find((r) => r.id === req.id);
      if (stored && stored.status === 'pending') stored.status = 'expired';
    });

    setStatusChip('declined', 'Declined — finding next match…');
    document.getElementById('status-detail').innerHTML = '<p>Looking for the next closest available driver…</p>';

    setTimeout(() => {
      const state = loadState();
      const next = findClosestDriver(state, req.routeId, req.passengerLocation, req.triedDriverIds);
      if (!next) {
        renderNoDrivers();
        return;
      }
      const newReq = {
        id: 'req-' + Math.random().toString(36).slice(2, 9),
        passengerId,
        passengerName,
        passengerLocation: req.passengerLocation,
        routeId: req.routeId,
        stopId: req.stopId,
        driverId: next.id,
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + REQUEST_TIMEOUT_MS,
        triedDriverIds: [...req.triedDriverIds, next.id],
      };
      updateState((s) => { s.requests.push(newReq); });
      tick();
    }, 900); // brief pause so "finding next match" is visible during the demo
  }

  function renderAccepted(req) {
    setStatusChip('accepted', 'Accepted — en route');
    const state = loadState();
    const driver = state.drivers.find((d) => d.id === req.driverId);
    const stop = findStop(req.routeId, req.stopId);
    if (!driver || !stop) return;

    const km = distanceKm(driver.currentLocation, stop);
    const etaMin = estimateEtaMinutes(km);

    document.getElementById('status-detail').innerHTML = `
      <p>✅ <strong>${driver.name}</strong> accepted your request and is on the way to
      <strong>${stop.name}</strong>.</p>
      <p class="eta">Estimated arrival: ~${etaMin} min</p>
    `;
    document.getElementById('btn-reset').style.display = 'inline-block';

    if (animatingForRequestId === req.id) return; // already animating
    animatingForRequestId = req.id;
    if (animCancel) animCancel();

    // ensure marker exists on map
    let marker = driverMarkers[driver.id];
    if (!marker) {
      marker = L.marker([driver.currentLocation.lat, driver.currentLocation.lng], {
        icon: ICONS.driverMatched(),
      }).addTo(map);
      driverMarkers[driver.id] = marker;
    } else {
      marker.setIcon(ICONS.driverMatched());
    }

    const durationMs = Math.max(6000, etaMin * 1500); // sped up for demo purposes
    animCancel = animateMarker(
      marker,
      driver.currentLocation,
      { lat: stop.lat, lng: stop.lng },
      durationMs,
      null,
      () => {
        document.querySelector('.eta').textContent = 'Driver has arrived at the pickup point!';
      }
    );
  }

  document.getElementById('btn-reset').addEventListener('click', () => {
    window.location.reload();
  });
})();
