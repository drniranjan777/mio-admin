import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, refreshOnce, session } from '../api/client';
import type { AdminAccess, AdminUser, Permission } from '../lib/types';

type Tokens = { accessToken: string; refreshToken: string };

interface AuthState {
  user: AdminUser | null;
  access: AdminAccess | null;
  ready: boolean;
  /** UI hint only — the API enforces every permission itself. */
  can: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [ready, setReady] = useState(false);

  const signedIn = useCallback((u: AdminUser, a: AdminAccess, tokens?: Tokens) => {
    if (tokens) session.set(tokens);
    setUser(u);
    setAccess(a);
  }, []);

  useEffect(() => {
    session.onEnd(() => {
      setUser(null);
      setAccess(null);
    });
    // Resume the tab's session (refresh token in sessionStorage).
    (async () => {
      if (session.refreshToken() && (await refreshOnce())) {
        try {
          const me = await api.get<{ user: AdminUser; access: AdminAccess }>('/me');
          if (me.data.user.role === 'admin') signedIn(me.data.user, me.data.access);
          else session.clear();
        } catch {
          session.clear();
        }
      }
      setReady(true);
    })();
  }, [signedIn]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ user: AdminUser; access: AdminAccess; tokens: Tokens }>('/auth/admin/login', { email, password }, false);
      signedIn(res.data.user, res.data.access, res.data.tokens);
    },
    [signedIn],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const res = await api.post<{ user: AdminUser; access: AdminAccess; tokens: Tokens }>('/auth/admin/change-password', { currentPassword, newPassword });
      signedIn(res.data.user, res.data.access, res.data.tokens);
    },
    [signedIn],
  );

  const logout = useCallback(async () => {
    const refreshToken = session.refreshToken();
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken }, false);
    } finally {
      session.clear();
      setUser(null);
      setAccess(null);
    }
  }, []);

  const can = useCallback((p: Permission) => Boolean(access?.isSuper || access?.permissions.includes(p)), [access]);

  const value = useMemo(() => ({ user, access, ready, can, login, changePassword, logout }), [user, access, ready, can, login, changePassword, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
