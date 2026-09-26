import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { defaultRegionId, regions } from "../config/regions.js";
import { distanceMeters, getBrowserLocation } from "../utils/geo.js";
import { useAuth } from "./AuthContext.jsx";

const RegionContext = createContext(null);
const STORAGE_KEY = "nagar-setu-active-region";

function findNearestRegion(coords) {
  const ranked = regions
    .map((region) => ({
      region,
      distance: distanceMeters(coords, { latitude: region.defaultCenterLat, longitude: region.defaultCenterLng }),
    }))
    .sort((a, b) => a.distance - b.distance);
  return ranked[0]?.region.regionId || defaultRegionId;
}

// Active region for public, pre-login browsing (home feed, map, complaint
// feed). Independent of the per-user regionPreference used by the
// login-gated report/admin flows: a signed-in user's stored preference wins
// if present, otherwise this falls back to a locally-remembered choice, then
// a one-time geolocation-based nearest-region guess, then the app default.
export function RegionProvider({ children }) {
  const { user, updateRegionPreference } = useAuth();
  const [activeRegion, setActiveRegionState] = useState(
    () => user?.regionPreference || localStorage.getItem(STORAGE_KEY) || defaultRegionId,
  );
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    if (user?.regionPreference) {
      setActiveRegionState(user.regionPreference);
    }
  }, [user?.regionPreference]);

  useEffect(() => {
    if (user?.regionPreference || localStorage.getItem(STORAGE_KEY) || detected) return;
    setDetected(true);
    getBrowserLocation()
      .then((coords) => {
        const nearest = findNearestRegion(coords);
        setActiveRegionState(nearest);
        localStorage.setItem(STORAGE_KEY, nearest);
      })
      .catch(() => {
        // Permission denied or unavailable - keep the default region, no toast.
      });
  }, [detected, user?.regionPreference]);

  const setActiveRegion = useCallback(
    (regionId) => {
      setActiveRegionState(regionId);
      localStorage.setItem(STORAGE_KEY, regionId);
      if (user) updateRegionPreference(regionId);
    },
    [updateRegionPreference, user],
  );

  const value = useMemo(() => ({ activeRegion, setActiveRegion }), [activeRegion, setActiveRegion]);

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion() {
  const context = useContext(RegionContext);
  if (!context) throw new Error("useRegion must be used inside RegionProvider");
  return context;
}
