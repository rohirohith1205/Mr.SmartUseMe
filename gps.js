// gps.js — Handles GPS location + Leaflet map for MR.SmartUSEME

// ────────────────────────────────────────────────
// 1. Get current location (one-shot)
// ────────────────────────────────────────────────
function getCurrentLocation(callbackSuccess, callbackError) {
  if (!navigator.geolocation) {
    callbackError('Geolocation is not supported by your browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      callbackSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toLocaleString()
      });
    },
    (error) => {
      const msgs = {
        [error.PERMISSION_DENIED]: 'User denied the request for Geolocation.',
        [error.POSITION_UNAVAILABLE]: 'Location information is unavailable.',
        [error.TIMEOUT]: 'The request to get user location timed out.'
      };
      callbackError(msgs[error.code] || 'Unknown geolocation error.');
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

// ────────────────────────────────────────────────
// 2. Continuously watch location changes (live tracking)
// ────────────────────────────────────────────────
let watchId = null;

function startWatchingLocation(onUpdate, onError) {
  if (!navigator.geolocation) return;
  if (watchId !== null) return; // already watching

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toLocaleString()
      });
    },
    (error) => onError(error.message || 'Watch error'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function stopWatchingLocation() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// ────────────────────────────────────────────────
// 3. Initialize (or refresh) Leaflet map
//    Safe to call multiple times — destroys old instance first.
// ────────────────────────────────────────────────
let _mapInstance = null;

function initMapWithLocation(mapContainerId = 'map', options = {}) {
  const config = {
    zoom: 15,
    markerText: '📍 Current Location',
    showAccuracyCircle: true,
    ...options
  };

  const mapEl = document.getElementById(mapContainerId);
  if (!mapEl) {
    console.error(`Map container #${mapContainerId} not found`);
    return null;
  }

  // Destroy previous Leaflet instance if it exists
  if (_mapInstance) {
    _mapInstance.remove();
    _mapInstance = null;
  }

  // Create map centred at (0,0) temporarily
  const map = L.map(mapContainerId, { zoomControl: true }).setView([0, 0], 2);
  _mapInstance = map;

  // Dark-themed tiles (CartoDB Dark Matter — no API key needed)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Custom neon-green marker icon
  const greenIcon = L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#00ff9d;border:3px solid #fff;box-shadow:0 0 8px #00ff9d;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  let userMarker = null;
  let accuracyCircle = null;

  getCurrentLocation(
    ({ latitude, longitude, accuracy }) => {
      map.setView([latitude, longitude], config.zoom);

      userMarker = L.marker([latitude, longitude], { icon: greenIcon })
        .addTo(map)
        .bindPopup(
          `<b>${config.markerText}</b><br>
           Lat: ${latitude.toFixed(6)}<br>
           Lon: ${longitude.toFixed(6)}<br>
           Accuracy: ±${accuracy.toFixed(0)} m`
        )
        .openPopup();

      if (config.showAccuracyCircle) {
        accuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#00ff9d',
          fillColor: '#00ff9d',
          fillOpacity: 0.12,
          weight: 1
        }).addTo(map);
      }
    },
    (err) => {
      mapEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;flex-direction:column;gap:8px;">
          <i class="fas fa-map-marker-alt" style="font-size:2rem;"></i>
          <p>${err}</p>
          <p style="color:#9ca3af;font-size:0.8rem;">Please allow location access and refresh.</p>
        </div>`;
    }
  );

  return map;
}

// ────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────
window.GPS = {
  getCurrentLocation,
  startWatchingLocation,
  stopWatchingLocation,
  initMapWithLocation
};