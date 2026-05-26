"use client";

/**
 * Auth identity context (AC-CD19, FE-1 §C.4).
 *
 * On mount, attempts to resolve the current user by hitting
 * `/v1/auth/me`. If the in-memory access token is unset (page reload)
 * but a refresh token exists in localStorage, the refresh-coordinator
 * fires first to obtain an access token, then `/v1/auth/me` runs.
 *
 * A monotonic generation counter (`generationRef`) tags each in-flight
 * `refreshMe` call. Subsequent `logout()`s and component unmount
 * advance the generation so a slow `/v1/auth/me` response can't
 * resurrect a signed-out session or write to an unmounted provider.
 *
 * Exposes:
 *  - `user`: the resolved `UserResponse`, or `null` if unauthenticated.
 *  - `status`: "loading" | "authenticated" | "unauthenticated".
 *  - `privacy_ack_at`, `role`: narrowed projections from `user`.
 *  - `logout()`: clears tokens, hits `/v1/auth/logout` (advisory).
 *  - `refreshMe()`: re-pulls `/v1/auth/me`. Login + privacy-ack call
 *     this after success so the context reflects the new state.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, client, unwrap } from "@/lib/api/client";
import type { UserResponse } from "@/lib/api/types";
import { clearTokens, getAccessToken, getRefreshToken } from "@/lib/auth/storage";
import { refreshAccessToken } from "@/lib/auth/refresh";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
export type AuthRole = "testee" | "admin";

type AuthContextValue = {
  user: UserResponse | null;
  status: AuthStatus;
  privacy_ack_at: string | null;
  role: AuthRole | null;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const narrowRole = (r: string | undefined | null): AuthRole | null =>
  r === "admin" || r === "testee" ? r : null;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  // Each refreshMe call captures the current generation; logout and
  // unmount advance it so stale /v1/auth/me responses are dropped
  // instead of resurrecting a signed-out session.
  const generationRef = useRef(0);

  const refreshMe = useCallback(async (): Promise<void> => {
    const ticket = ++generationRef.current;
    try {
      const me = await unwrap(client.GET("/v1/auth/me"));
      if (ticket !== generationRef.current) return;
      setUser(me);
      setStatus("authenticated");
    } catch (err) {
      if (ticket !== generationRef.current) return;
      if (err instanceof ApiError && err.status !== 401) {
        // Non-auth error (e.g. 503): surface to console but stay
        // in the unauthenticated state — a login attempt will
        // re-trigger the request.
        // eslint-disable-next-line no-console
        console.error("auth/me failed:", err);
      }
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    const resolve = async () => {
      if (!getAccessToken() && getRefreshToken()) {
        try {
          await refreshAccessToken();
        } catch (err) {
          // Network failures during refresh would otherwise be invisible —
          // surface them so connectivity issues are debuggable. The
          // subsequent `/v1/auth/me` call still runs and drives the
          // unauthenticated branch below.
          // eslint-disable-next-line no-console
          console.warn("auth/refresh failed:", err);
        }
      }
      await refreshMe();
    };
    void resolve();
    return () => {
      // Invalidate any in-flight refreshMe so its setUser/setStatus is
      // a no-op against the unmounted provider. The exhaustive-deps
      // rule targets DOM-node refs whose .current may have detached;
      // generationRef holds a plain counter, so mutating it here is
      // exactly the intent.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generationRef.current++;
    };
  }, [refreshMe]);

  const logout = useCallback(async (): Promise<void> => {
    // Invalidate before the await so a concurrent refreshMe can't
    // re-authenticate the user after we clear the session.
    generationRef.current++;
    try {
      await unwrap(client.POST("/v1/auth/logout"));
    } catch {
      /* logout is advisory; ignore failures */
    }
    clearTokens();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      privacy_ack_at: user?.privacy_ack_at ?? null,
      role: narrowRole(user?.role),
      logout,
      refreshMe,
    }),
    [user, status, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
