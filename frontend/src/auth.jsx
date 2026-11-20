import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "./supabase";

export const ROLES = [
  { id: "owner", label: "Owner", note: "Full control of the workspace, people and settings." },
  { id: "admin", label: "Admin", note: "Runs the workspace: people, projects, clients and finances." },
  { id: "manager", label: "Manager", note: "Manages projects, tasks, clients and expenses." },
  { id: "member", label: "Member", note: "Works on assigned tasks and reads shared projects." },
  { id: "viewer", label: "Viewer", note: "Read-only access to projects they belong to." },
];

export const ROLE_LABELS = Object.fromEntries(ROLES.map(role => [role.id, role.label]));

const AuthContext = createContext(null);

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchProfile(userId, attempts = 1) {
  if (!supabase) return null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    if (attempt < attempts - 1) await wait(250 * (attempt + 1));
  }
  return null;
}

function errorMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message || "Something went wrong. Please try again.";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  // Populated from get_workspace().user by StoreProvider; this is the single
  // source of truth for permissions (the old hardcoded matrix was removed).
  const [workspaceUser, setWorkspaceUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [serverError, setServerError] = useState(
    supabaseConfigured
      ? ""
      : "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env, then restart the dev server."
  );
  const [notice, setNotice] = useState("");
  const activeRef = useRef(true);

  const loadStatus = useCallback(async () => {
    if (!supabaseConfigured) return null;
    const { data, error } = await supabase.rpc("workspace_status");
    if (error) {
      setServerError(
        /function|schema|does not exist|could not find/i.test(error.message)
          ? "The Supabase schema is missing. Run supabase/schema.sql in the Supabase SQL editor."
          : error.message
      );
      return null;
    }
    setNeedsSetup(Boolean(data?.needsSetup));
    return data;
  }, []);

  const applySession = useCallback(async (nextSession, { retryProfile = 1 } = {}) => {
    if (!supabaseConfigured) return null;
    if (!nextSession?.user) {
      setSession(null);
      setProfile(null);
      setWorkspaceUser(null);
      return null;
    }

    const nextProfile = await fetchProfile(nextSession.user.id, retryProfile);
    if (!activeRef.current) return null;

    setSession(nextSession);

    if (!nextProfile) {
      setProfile(null);
      setServerError("Signed in, but no workspace profile was found. Run supabase/schema.sql or ask the owner to invite this email.");
      return null;
    }

    if (nextProfile.disabled) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setWorkspaceUser(null);
      setServerError("Your access to this workspace was removed. Ask the owner to restore it.");
      return null;
    }

    setProfile(nextProfile);
    setServerError("");
    setNeedsSetup(false);
    return nextProfile;
  }, []);

  useEffect(() => {
    activeRef.current = true;

    if (!supabaseConfigured) {
      setLoading(false);
      return () => { activeRef.current = false; };
    }

    let cancelled = false;
    const timers = new Set();

    loadStatus().catch(error => {
      if (!cancelled) setServerError(errorMessage(error));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setWorkspaceUser(null);
        setLoading(false);
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        setSession(nextSession);
        return;
      }

      // Keep database work out of the auth callback lock.
      const timer = setTimeout(async () => {
        timers.delete(timer);
        try {
          await applySession(nextSession);
          await loadStatus();
        } catch (error) {
          if (!cancelled) setServerError(errorMessage(error));
        } finally {
          if (!cancelled) setLoading(false);
        }
      }, 0);
      timers.add(timer);
    });

    return () => {
      cancelled = true;
      activeRef.current = false;
      timers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, [applySession, loadStatus]);

  const login = useCallback(async ({ email, password }) => {
    if (!supabase) throw new Error("Supabase is not configured. Add your keys to .env and restart the dev server.");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || "").trim(),
      password,
    });

    if (error) {
      throw new Error(
        /invalid login credentials/i.test(error.message)
          ? "Invalid email or password."
          : error.message
      );
    }

    const nextProfile = await fetchProfile(data.user.id);
    if (!nextProfile) {
      await supabase.auth.signOut();
      throw new Error("This account has no workspace profile yet. Ask the owner to invite your email.");
    }
    if (nextProfile.disabled) {
      await supabase.auth.signOut();
      throw new Error("Your access to this workspace was removed. Ask the owner to restore it.");
    }
    setSession(data.session);
    setProfile(nextProfile);
    setServerError("");
    return nextProfile;
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    if (!supabase) throw new Error("Supabase is not configured. Add your keys to .env and restart the dev server.");
    const { data, error } = await supabase.auth.signUp({
      email: String(email || "").trim(),
      password,
      options: { data: { name: String(name || "").trim() } },
    });

    if (error) throw new Error(error.message);
    if (!data.session) return { needsConfirmation: true, profile: null };

    const nextProfile = await fetchProfile(data.user.id, 4);
    if (!nextProfile) {
      throw new Error("Account created, but the profile is not ready yet. Refresh the page and log in.");
    }

    setSession(data.session);
    setProfile(nextProfile);
    setNeedsSetup(false);
    setServerError("");

    if (nextProfile.role === "viewer") {
      setNotice("Your account is ready as Viewer. An owner can change your role or add you to projects.");
    }

    return { needsConfirmation: false, profile: nextProfile };
  }, []);

  const logout = useCallback(async () => {
    if (supabaseConfigured) {
      try { await supabase.auth.signOut(); } catch { /* clear locally anyway */ }
    }
    setSession(null);
    setProfile(null);
    setWorkspaceUser(null);
    setNotice("");
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabaseConfigured) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return applySession(data.session);
  }, [applySession]);

  const user = useMemo(() => {
    if (!profile) return null;
    return {
      ...profile,
      ...(workspaceUser || {}),
      id: profile.id,
      role: profile.role,
      disabled: profile.disabled,
      permissions: workspaceUser?.permissions || [],
    };
  }, [profile, workspaceUser]);

  const hasPermission = useCallback(permission => {
    if (!user || user.disabled) return false;
    const permissions = user.permissions || [];
    return permissions.includes("*") || permissions.includes(permission);
  }, [user]);

  const setWorkspacePermissionsUser = useCallback(next => {
    setWorkspaceUser(next || null);
  }, []);

  const clearNotice = useCallback(() => setNotice(""), []);

  const value = useMemo(() => ({
    user,
    session,
    token: session?.access_token || "",
    loading,
    needsSetup,
    serverError,
    notice,
    clearNotice,
    configured: supabaseConfigured,
    login,
    register,
    logout,
    refreshProfile,
    hasPermission,
    setWorkspacePermissionsUser,
    roles: ROLES,
  }), [
    user, session, loading, needsSetup, serverError, notice, clearNotice,
    login, register, logout, refreshProfile, hasPermission, setWorkspacePermissionsUser,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
