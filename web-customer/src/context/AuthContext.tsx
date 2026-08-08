import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '../types';
import {
  api,
  saveTokens,
  clearTokens,
  getAccessToken,
  ApiClientError,
} from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ user: null, loading: false, error: null });
      return;
    }

    try {
      const res = await api.getMe();
      setState({ user: res.data, loading: false, error: null });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearTokens();
        setState({ user: null, loading: false, error: null });
      } else {
        setState((prev) => ({ ...prev, loading: false, error: null }));
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, error: null, loading: true }));
    try {
      const res = await api.login({ email, password });
      saveTokens(res.data);
      setState({ user: res.data.user, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Login failed. Please try again.';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setState((prev) => ({ ...prev, error: null, loading: true }));
      try {
        const res = await api.register({ name, email, password });
        saveTokens(res.data);
        setState({ user: res.data.user, loading: false, error: null });
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : 'Registration failed. Please try again.';
        setState((prev) => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearTokens();
    setState({ user: null, loading: false, error: null });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, refreshUser }}
    >
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
