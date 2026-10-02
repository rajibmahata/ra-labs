import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { auth as authApi, team as teamApi, setAuth, clearAuth, getStoredUser, isAuthenticated, ApiClientError } from '../api/client';
import type { AdminUser, TeamMember } from '../types';

interface AuthContextValue {
  user: AdminUser | null;
  teamProfile: TeamMember | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  refreshTeamProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [teamProfile, setTeamProfile] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTeamProfile = useCallback(async () => {
    try {
      const res = await teamApi.getMe();
      setTeamProfile(res.data as TeamMember);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) {
        setTeamProfile(null);
      } else {
        console.error('Failed to load team profile', e);
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (isAuthenticated()) {
        const storedUser = getStoredUser<AdminUser>();
        if (storedUser) {
          setUser(storedUser);
          await loadTeamProfile();
        } else {
          clearAuth();
        }
      }
      setLoading(false);
    };
    init();
  }, [loadTeamProfile]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      setTeamProfile(null);
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const login = useCallback(async (email: string, password: string, remember = true) => {
    const res = await authApi.login(email, password);
    const { accessToken, expiresAt, user: userData } = res.data;
    setAuth(accessToken, userData, expiresAt, remember);
    setUser(userData as AdminUser);
    await loadTeamProfile();
  }, [loadTeamProfile]);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setTeamProfile(null);
  }, []);

  const refreshTeamProfile = useCallback(async () => {
    await loadTeamProfile();
  }, [loadTeamProfile]);

  return (
    <AuthContext.Provider value={{ user, teamProfile, loading, login, logout, refreshTeamProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
