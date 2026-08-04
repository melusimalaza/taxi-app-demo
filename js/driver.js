(function () {
  const JHB_CENTER = { lat: -26.1900, lng: 28.0000 };

  let myDriverId = sessionStorage.getItem('taxiDriverId') || null;
  let map;
  let myMarker = null;
  let routeLine = null;
  const stopMarkers = [];
  let newDriverLocation = null;
  let newDriverMap = null;
  let newDriverMapMarker = null;
  let newDriverRouteLine = null;
  const newDriverStopMarkers = [];

  // ---------- STEP 1: login ----------
  const driverSelect = document.getElementById('driver-select');
  MOCK_DRIVERS.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.name} — ${findRoute(d.routeId).name}`;
    driverSelect.appendChild(opt);
  });

  function updateExistingDriverInfo() {
    const d = MOCK_DRIVERS.find((x) => x.id === driverSelect.value);
    const info = document.getElementById('existing-driver-info');
    if (!d) { info.textContent = ''; return; }
    const route = findRoute(d.routeId);
    info.textContent = `Route: ${route.name} · ${route.stops.length} stops · currently ${d.status}`;
  }
  driverSelect.addEventListener('change', () => { updateExistingDriverInfo(); refreshLoginBlocker(); });
  updateExistingDriverInfo();

  const modeExisting = document.getElementById('mode-existing');
  const modeNew = document.getElementById('mode-new');
  function applyLoginMode() {
    const isNew = modeNew.checked;
    document.getElementById('existing-driver-form').style.display = isNew ? 'none' : 'block';
    document.getElementById('new-driver-form').style.display = isNew ? 'block' : 'none';
    if (isNew) initNewDriverForm();
    refreshLoginBlocker();
  }
  modeExisting.addEventListener('change', applyLoginMode);
  modeNew.addEventListener('change', applyLoginMode);

  function initNewDriverForm() {
    const routeSel = document.getElementById('new-driver-route');
    if (!routeSel.dataset.populated) {
      MOCK_ROUTES.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        routeSel.appendChild(opt);
      });
      routeSel.dataset.populated = '1';
      routeSel.addEventListener('change', onNewDriverRouteChange);
    }
    document.getElementById('new-driver-name').addEventListener('input', refreshLoginBlocker);
    const locateBtn = document.getElementById('btn-new-driver-locate');
    if (!locateBtn.dataset.wired) {
      locateBtn.dataset.wired = '1';
      locateBtn.addEventListener('click', requestNewDriverGeolocation);
    }
    if (!newDriverMap) {
      newDriverMap = L.map('new-driver-map').setView([JHB_CENTER.lat, JHB_CENTER.lng], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(newDriverMap);
      newDriverMap.on('click', (e) => setNewDriverLocation(e.latlng.lat, e.latlng.lng));
      setTimeout(() => newDriverMap.invalidateSize(), 200);
    }
  }

  function setNewDriverLocation(lat, lng) {
    newDriverLocation = { lat, lng };
    if (newDriverMapMarker) newDriverMap.removeLayer(newDriverMapMarker);
    newDriverMapMarker = L.marker([lat, lng], { icon: ICONS.driverOffline() })
      .addTo(newDriverMap)
      .bindPopup('Your location')
      .openPopup();
    document.getElementById('new-driver-location-info').textContent =
      `📍 Location set (${lat.toFixed(4)}, ${lng.toFixed(4)}).`;
    refreshLoginBlocker();
  }

  function requestNewDriverGeolocation() {
    const info = document.getElementById('new-driver-location-info');
    if (!('geolocation' in navigator)) {
      info.textContent = 'Location services aren’t available on this device — tap the map to set it manually.';
      return;
    }
    info.innerHTML = '<span class="locate-spinner"></span>Finding your location…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewDriverLocation(pos.coords.latitude, pos.coords.longitude);
        newDriverMap.setView([pos.coords.latitude, pos.coords.longitude], 13);
      },
      (err) => {
        info.textContent = `Couldn't get your location (${err.message}). Tap the map to set it manually.`;
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function onNewDriverRouteChange() {
    const routeId = document.getElementById('new-driver-route').value;
    if (newDriverRouteLine) { newDriverMap.removeLayer(newDriverRouteLine); newDriverRouteLine = null; }
    newDriverStopMarkers.forEach((m) => newDriverMap.removeLayer(m));
    newDriverStopMarkers.length = 0;

    const info = document.getElementById('new-driver-route-info');
    if (!routeId) {
      info.textContent = 'Pick a route to see its stops on the map.';
      refreshLoginBlocker();
      return;
    }
    const route = findRoute(routeId);
    info.textContent = `${route.name}: ${route.stops.length} stops shown on the map below.`;
    newDriverRouteLine = L.polyline(route.stops.map((s) => [s.lat, s.lng]), {
      color: '#0f7b52', weight: 3, opacity: 0.6,
    }).addTo(newDriverMap);
    route.stops.forEach((s) => {
      const m = L.marker([s.lat, s.lng], { icon: ICONS.stop() }).addTo(newDriverMap).bindPopup(s.name);
      newDriverStopMarkers.push(m);
    });
    setTimeout(() => {
      newDriverMap.invalidateSize();
      newDriverMap.fitBounds(newDriverRouteLine.getBounds(), { padding: [30, 30] });
    }, 50);
    refreshLoginBlocker();
  }

  function refreshLoginBlocker() {
    const btn = document.getElementById('btn-login');
    const blocker = document.getElementById('login-blocker');
    if (modeNew.checked) {
      const name = document.getElementById('new-driver-name').value.trim();
      const routeId = document.getElementById('new-driver-route').value;
      const missing = [];
      if (!name) missing.push('your name');
      if (!routeId) missing.push('a route');
      if (!newDriverLocation) missing.push('your location (tap the map)');
      btn.disabled = missing.length > 0;
      blocker.textContent = missing.length ? `Still needed: ${missing.join(', ')}.` : '';
    } else {
      btn.disabled = !driverSelect.value;
      blocker.textContent = '';
    }
  }
  refreshLoginBlocker();

  document.getElementById('btn-login').addEventListener('click', () => {
    if (modeNew.checked) {
      const name = document.getElementById('new-driver-name').value.trim();
      const routeId = document.getElementById('new-driver-route').value;
      if (!name || !routeId || !newDriverLocation) { refreshLoginBlocker(); return; }
      const newDriver = {
        id: 'driver-' + Math.random().toString(36).slice(2, 9),
        name,
        routeId,
        currentLocation: newDriverLocation,
        status: 'offline',
      };
      updateState((s) => { s.drivers.push(newDriver); });
      myDriverId = newDriver.id;
    } else {
      if (!driverSelect.value) return;
      myDriverId = driverSelect.value;
    }

    sessionStorage.setItem('taxiDriverId', myDriverId);
    Notify.requestPermission();
    enterDashboard();
  });

  // ---------- STEP 2: dashboard ----------
  function getMe() {
    return loadState().drivers.find((d) => d.id === myDriverId) || null;
  }

  function enterDashboard() {
    document.getElementById('panel-login').style.display = 'none';
    document.getElementById('panel-dashboard').style.display = 'block';
    document.getElementById('panel-request').style.display = 'block';

    const me = getMe();
    document.getElementById('driver-tag').textContent = `Logged in as ${me.name} — ${findRoute(me.routeId).name}`;

    initMap(me);
    renderOnlineToggle(me);
    renderStops(me);

    subscribeStore(render);
    setInterval(render, 400);
    render();
  }

  function initMap(me) {
    map = L.map('map').setView([me.currentLocation.lat, me.currentLocation.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const route = findRoute(me.routeId);
    routeLine = L.polyline(route.stops.map((s) => [s.lat, s.lng]), {
      color: '#0f7b52', weight: 3, opacity: 0.6,
    }).addTo(map);

    route.stops.forEach((s) => {
      const m = L.marker([s.lat, s.lng], { icon: ICONS.stop() }).addTo(map).bindPopup(s.name);
      stopMarkers.push(m);
    });

    myMarker = L.marker([me.currentLocation.lat, me.currentLocation.lng], {
      icon: me.status === 'online' ? ICONS.driverOnline() : ICONS.driverOffline(),
    }).addTo(map).bindPopup(me.name);

    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
  }

  function renderStops(me) {
    const route = findRoute(me.routeId);
    const list = document.getElementById('driver-stop-list');
    list.innerHTML = '';
    route.stops.forEach((s) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>📍 ${s.name}</span>`;
      list.appendChild(li);
    });
  }

  function renderOnlineToggle(me) {
    const chip = document.getElementById('online-chip');
    const text = document.getElementById('online-text');
    const btn = document.getElementById('btn-toggle-online');
    if (me.status === 'online') {
      chip.className = 'status-chip status-accepted';
      text.textContent = 'Online — visible to passengers';
      btn.textContent = 'Go Offline';
    } else if (me.status === 'matched') {
      chip.className = 'status-chip status-accepted';
      text.textContent = 'Matched — en route';
      btn.textContent = 'Go Offline';
    } else {
      chip.className = 'status-chip status-idle';
      text.textContent = 'Offline';
      btn.textContent = 'Go Online';
    }
    if (myMarker) myMarker.setIcon(me.status === 'offline' ? ICONS.driverOffline() : (me.status === 'matched' ? ICONS.driverMatched() : ICONS.driverOnline()));
  }

  document.getElementById('btn-toggle-online').addEventListener('click', () => {
    updateState((s) => {
      const me = s.drivers.find((d) => d.id === myDriverId);
      me.status = me.status === 'offline' ? 'online' : 'offline';
    });
    render();
  });

  // ---------- STEP 3: incoming request ----------
  let animCancel = null;
  let animatingForRequestId = null;
  let lastNotifiedRequestId = null;

  function render() {
    const me = getMe();
    if (!me) return;
    renderOnlineToggle(me);

    const state = loadState();
    const req = getActiveRequestForDriver(state, myDriverId) ||
      state.requests
        .filter((r) => r.driverId === myDriverId && r.status === 'accepted')
        .slice(-1)[0];

    const card = document.getElementById('request-card');

    if (!req) {
      card.innerHTML = '<p style="color:var(--muted);margin:0">No incoming requests right now.</p>';
      return;
    }

    if (req.status === 'pending') {
      const stop = findStop(req.routeId, req.stopId);
      const secsLeft = Math.max(0, Math.ceil((req.expiresAt - Date.now()) / 1000));

      if (lastNotifiedRequestId !== req.id) {
        lastNotifiedRequestId = req.id;
        Notify.fire('🚖 New pickup request', `${req.passengerName} wants a ride to ${stop.name}. 90s to respond.`, { kind: 'waiting', tag: req.id });
      }
      card.innerHTML = `
        <h3>Pickup request from ${req.passengerName}</h3>
        <div class="meta">Pickup point: <strong>${stop.name}</strong> · Route: ${findRoute(req.routeId).name}</div>
        <div class="status-chip status-waiting"><span class="status-dot"></span>Waiting for your response — <span class="timer-ring">${secsLeft}s</span></div>
        <div style="margin-top:12px;display:flex;gap:10px">
          <button id="btn-accept">Accept</button>
          <button class="secondary" id="btn-decline">Decline</button>
        </div>
      `;
      document.getElementById('btn-accept').addEventListener('click', () => respond(req.id, 'accepted'));
      document.getElementById('btn-decline').addEventListener('click', () => respond(req.id, 'declined'));

      if (secsLeft === 0) {
        card.querySelector('.status-chip').className = 'status-chip status-declined';
        card.querySelector('.status-chip').lastChild.textContent = 'Timed out — passenger is finding the next driver';
        const btns = card.querySelectorAll('button');
        btns.forEach((b) => (b.disabled = true));
      }
      return;
    }

    if (req.status === 'accepted') {
      const stop = findStop(req.routeId, req.stopId);
      card.innerHTML = `
        <h3>Matched with ${req.passengerName}</h3>
        <div class="meta">Heading to <strong>${stop.name}</strong></div>
        <div class="status-chip status-accepted"><span class="status-dot"></span>Accepted — en route</div>
        <p class="eta" id="driver-eta"></p>
      `;
      animateToward(req, stop);
      return;
    }

    card.innerHTML = '<p style="color:var(--muted);margin:0">No incoming requests right now.</p>';
  }

  function respond(requestId, status) {
    updateState((s) => {
      const req = s.requests.find((r) => r.id === requestId);
      if (!req || req.status !== 'pending') return;
      req.status = status;
      const me = s.drivers.find((d) => d.id === myDriverId);
      if (status === 'accepted') me.status = 'matched';
    });
    render();
  }

  function animateToward(req, stop) {
    if (animatingForRequestId === req.id) return;
    animatingForRequestId = req.id;
    if (animCancel) animCancel();

    const me = getMe();
    const km = distanceKm(me.currentLocation, stop);
    const etaMin = estimateEtaMinutes(km);
    const durationMs = Math.max(6000, etaMin * 1500);

    animCancel = animateMarker(
      myMarker,
      me.currentLocation,
      { lat: stop.lat, lng: stop.lng },
      durationMs,
      (t) => {
        const etaEl = document.getElementById('driver-eta');
        if (etaEl) etaEl.textContent = `Estimated arrival: ~${Math.max(1, Math.round(etaMin * (1 - t)))} min`;
      },
      () => {
        const etaEl = document.getElementById('driver-eta');
        if (etaEl) etaEl.textContent = 'Arrived at pickup point!';
      }
    );
  }
})();
