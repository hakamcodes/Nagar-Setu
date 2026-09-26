import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "../services/firebase.js";
import { readStore, upsertUser } from "../services/prototypeStore.js";
import { defaultRegionId } from "../config/regions.js";
import { listOfficers, resolveRoleForEmail } from "../services/officerService.js";

const AuthContext = createContext(null);
const OFFICER_ROLES = ["junior-officer", "senior-officer", "super-admin"];

// Firebase env vars are only allowed to be missing during local development.
// In a production build, a missing config must fail loudly rather than let
// signInEmail/signUpEmail/signInWithGoogle silently accept any credentials.
const ALLOW_UNCONFIGURED_AUTH = import.meta.env.DEV;

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "No account exists for that email. Try signing up instead.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "An account already exists for that email. Try signing in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
};

function friendlyAuthError(error) {
  return AUTH_ERROR_MESSAGES[error?.code] || error?.message || "Could not sign in.";
}

// Role/zone are never taken from the client - they always come from
// VITE_ADMIN_EMAILS (super admin) or the officers roster, looked up fresh on
// every sign-in.
async function buildUser({ uid, email, name, photoURL }) {
  const roster = await listOfficers();
  const { role, zoneNumber } = resolveRoleForEmail(email, roster);
  return {
    uid,
    name: name || email?.split("@")[0] || "Citizen",
    email,
    photoURL: photoURL || "",
    role,
    zoneNumber,
    regionPreference: defaultRegionId,
    // Ward-personalisation fields — null until the user sets their home location.
    // { number, name } | null
    homeWard: null,
    homeLat: null,
    homeLng: null,
    createdAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("nagar-setu-current-user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        localStorage.removeItem("nagar-setu-current-user");
        setLoading(false);
        return;
      }
      buildUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      }).then((normalized) => {
        // Preserve ward/location profile saved from a prior session for this UID
        // so the user's home ward isn't wiped on every Firebase token refresh.
        const prior = (() => {
          try { return JSON.parse(localStorage.getItem("nagar-setu-current-user") || "null"); } catch { return null; }
        })();
        const withProfile = (prior?.uid === normalized.uid)
          ? { ...normalized, homeWard: prior.homeWard ?? null, homeLat: prior.homeLat ?? null, homeLng: prior.homeLng ?? null }
          : normalized;
        setUser(withProfile);
        upsertUser(withProfile);
        localStorage.setItem("nagar-setu-current-user", JSON.stringify(withProfile));
        setLoading(false);
      });
    });
  }, []);

  const setSession = useCallback((nextUser) => {
    setUser(nextUser);
    if (nextUser) {
      upsertUser(nextUser);
      localStorage.setItem("nagar-setu-current-user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("nagar-setu-current-user");
    }
  }, []);

  const signInDemo = useCallback((role = "citizen") => {
    const store = readStore();
    const demo = store.users.find((item) => item.role === role) || store.users[0];
    setSession(demo);
    return demo;
  }, [setSession]);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured) {
      if (ALLOW_UNCONFIGURED_AUTH) return signInDemo("citizen");
      throw new Error("Sign-in is not available right now. Please try again later.");
    }
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // onAuthStateChanged resolves the role/zone and updates context state.
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, [signInDemo]);

  const signInEmail = useCallback(async (email, password) => {
    if (!isFirebaseConfigured) {
      if (ALLOW_UNCONFIGURED_AUTH) {
        const nextUser = await buildUser({ uid: `local-${email.toLowerCase()}`, email });
        setSession(nextUser);
        return nextUser;
      }
      throw new Error("Sign-in is not available right now. Please try again later.");
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return null;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, [setSession]);

  const signUpEmail = useCallback(async (email, password, name) => {
    if (!isFirebaseConfigured) {
      if (ALLOW_UNCONFIGURED_AUTH) {
        const nextUser = await buildUser({ uid: `local-${email.toLowerCase()}`, email, name });
        setSession(nextUser);
        return nextUser;
      }
      throw new Error("Sign-up is not available right now. Please try again later.");
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      return null;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, [setSession]);

  const logout = useCallback(async () => {
    if (isFirebaseConfigured) await signOut(auth);
    setSession(null);
  }, [setSession]);

  const updateRegionPreference = useCallback((regionId) => {
    setUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, regionPreference: regionId };
      upsertUser(nextUser);
      localStorage.setItem("nagar-setu-current-user", JSON.stringify(nextUser));
      return nextUser;
    });
  }, []);

  // ward is { number, name } | null; lat/lng are numbers | null
  const updateHomeLocation = useCallback((ward, lat, lng) => {
    setUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, homeWard: ward ?? null, homeLat: lat ?? null, homeLng: lng ?? null };
      upsertUser(nextUser);
      localStorage.setItem("nagar-setu-current-user", JSON.stringify(nextUser));
      return nextUser;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: OFFICER_ROLES.includes(user?.role),
      signInDemo,
      signInWithGoogle,
      signInEmail,
      signUpEmail,
      logout,
      updateRegionPreference,
      updateHomeLocation,
    }),
    [loading, logout, signInDemo, signInEmail, signInWithGoogle, signUpEmail, updateRegionPreference, updateHomeLocation, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
