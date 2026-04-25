import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { exportPublicKey } from '../lib/crypto';

const API = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

const AuthContext = createContext(null);

// Safe JSON parser — never throws on empty body or non-JSON (502/504/gateway errors)
async function safeJson(res) {
  try {
    const text = await res.text();
    if (!text || text.trim() === '') return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // useRef so it persists across renders — prevents parallel refresh storms
  const refreshPromiseRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('st_token');
    const saved = localStorage.getItem('st_user');
    if (token && saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.message || `Server error (${res.status}) — is the backend running?`);
    return data;
  };

  const verify = async (email, otp) => {
    const res = await fetch(`${API}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.message || `Server error (${res.status}) — is the backend running?`);

    localStorage.setItem('st_token', data.token);
    localStorage.setItem('st_refresh', data.refreshToken || '');
    localStorage.setItem('st_user', JSON.stringify(data));
    setUser(data);

    // Register public key if not set
    if (!data.publicKey) {
      const publicKey = exportPublicKey();
      await fetch(`${API}/api/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.token}`
        },
        body: JSON.stringify({ publicKey })
      });
    }
    return data;
  };

  // useCallback so logout identity is stable for useEffect deps
  const logout = useCallback(async () => {
    const token = localStorage.getItem('st_token');
    if (token) {
      try {
        await fetch(`${API}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {}
    }
    localStorage.removeItem('st_token');
    localStorage.removeItem('st_refresh');
    localStorage.removeItem('st_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const merged = { ...prev, ...updates };
      localStorage.setItem('st_user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  const authFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem('st_token');
    // No token — bail immediately, don't fire a request
    if (!token) return new Response(JSON.stringify({ message: 'Not authenticated' }), { status: 401 });

    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` }
    });

    // Happy path — return as-is
    if (res.status !== 401) return res;

    // ── Access token rejected → attempt silent refresh ──────────────────
    const refresh = localStorage.getItem('st_refresh');
    if (!refresh) {
      logout();
      return res;
    }

    // Deduplicate: if a refresh is already in flight, await the same promise
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = fetch(`${API}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh })
      })
        .then(async (rRes) => {
          if (rRes.ok) {
            const rData = await rRes.json();
            localStorage.setItem('st_token', rData.token);
            localStorage.setItem('st_refresh', rData.refreshToken || refresh);
            return rData.token;
          }
          return null;
        })
        .catch(() => null)
        .finally(() => { refreshPromiseRef.current = null; });
    }

    const newToken = await refreshPromiseRef.current;
    if (newToken) {
      // Retry original request with refreshed token
      return fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newToken}` }
      });
    }

    // Refresh failed (expired / revoked) — force full logout
    logout();
    return res;
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, verify, logout, updateUser, authFetch, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
