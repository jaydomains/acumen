"use client";

/**
 * Auth identity context (AC-CD19).
 *
 * On mount, attempts to resolve the current user by hitting
 * `/v1/auth/me`. If the in-memory access token is unset (page reload)
 * but a refresh token exists in localStorage, the refresh-coordinator
 * fires first to obtain an access token, then `/v1/auth/me` runs.
 *
 * Exposes:
 *  - `user`: the resolved `UserResponse`, or `null` if unauthenticated.
 *  - `status`: "loading" | "authenticated" | "unauthenticated".
 *  - `logout()`: clears tokens, hits `/v1/auth/logout` (advisory).
 *
 * Login UI itself is out of scope for the scaffold PR — added in the
 * follow-up PR that builds the login page.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, client, unwrap } from "@/lib/api/client";
import type { UserResponse } from "@/lib/api/types";
import { clearTokens, getAccessToken, getRefreshToken } from "@/lib/auth/storage";
import { refreshAccessToken } from "@/lib/auth/refresh";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: UserResponse | null;
  status: AuthStatus;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
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
      try {
        const me = await unwrap(client.GET("/v1/auth/me"));
        if (!cancelled) {
          setUser(me);
          setStatus("authenticated");
        }
      } catch (err) {
        if (!cancelled) {
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
      }
    };
    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    try {
      await unwrap(client.POST("/v1/auth/logout"));
    } catch {
      /* logout is advisory; ignore failures */
    }
    clearTokens();
    setUser(null);
    setStatus("unauthenticated");
  };

  return (
    <AuthContext.Provider value={{ user, status, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
