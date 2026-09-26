const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function detectNearestZone(location, zones) {
  if (!location || !zones?.length) {
    return { zone: null, distance: null, status: "unavailable" };
  }

  const ranked = zones
    .map((zone) => ({
      zone,
      distance: distanceMeters(location, { latitude: zone.latitude, longitude: zone.longitude }),
    }))
    .sort((a, b) => a.distance - b.distance);

  const nearest = ranked[0];
  if (!nearest) return { zone: null, distance: null, status: "unavailable" };
  if (nearest.distance <= nearest.zone.radiusMeters) {
    return { zone: nearest.zone, distance: nearest.distance, status: "inside" };
  }
  return { zone: null, nearestZone: nearest.zone, distance: nearest.distance, status: "outside" };
}

export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}
