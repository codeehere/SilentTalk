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

// Retry on 503 (DB not ready during Railway cold-start) — up to 8x, 4 s apart
async function fetchWithWakeRetry(url, options, { maxRetries = 8, retryDelayMs = 4000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (networkErr) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      throw networkErr;
    }
    if (res.status === 503 && attempt < maxRetries) {
      await new Promise(r => setTimeout(r, retryDelayMs));
      continue;
    }
    return res;
  }
  const err = new Error('Server is taking too long to wake up. Please try again in a moment.');
  err.isWakingUp = true;
  throw err;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshPromiseRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('st_token');
    const saved = localStorage.getItem('st_user');
    if (token && saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    setLoading(false);
  }, []);

  // ── Register (new account) ──────────────────────────────────────────────────
  const register = async (email, password) => {
    const res  = await fetchWithWakeRetry(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.message || `Server error (${res.status})`);

    localStorage.setItem('st_token',   data.token);
    localStorage.setItem('st_refresh', data.refreshToken || '');
    localStorage.setItem('st_user',    JSON.stringify(data));
    setUser(data);

    // Register E2EE public key — fire-and-forget, user is already logged in
    if (!data.publicKey) {
      try {
        const publicKey = exportPublicKey();
        if (publicKey) {
          await fetch(`${API}/api/auth/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
            body: JSON.stringify({ publicKey })
          });
        }
      } catch (keyErr) {
        // Non-fatal — E2EE key can be registered later
        console.warn('[register] Could not register public key:', keyErr.message);
      }
    }
    return data;
  };

  // ── Login (existing account) ────────────────────────────────────────────────
  const login = async (email, password) => {
    const res  = await fetchWithWakeRetry(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.message || `Server error (${res.status})`);

    localStorage.setItem('st_token',   data.token);
    localStorage.setItem('st_refresh', data.refreshToken || '');
    localStorage.setItem('st_user',    JSON.stringify(data));
    setUser(data);
    return data;
  };

  // ── Logout ──────────────────────────────────────────────────────────────────
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

  // ── Authenticated fetch with auto token refresh ─────────────────────────────
  const authFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem('st_token');
    if (!token) return new Response(JSON.stringify({ message: 'Not authenticated' }), { status: 401 });

    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` }
    });

    if (res.status !== 401) return res;

    const refresh = localStorage.getItem('st_refresh');
    if (!refresh) { logout(); return res; }

    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = fetch(`${API}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh })
      })
        .then(async (rRes) => {
          if (rRes.ok) {
            const rData = await rRes.json();
            localStorage.setItem('st_token',   rData.token);
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
      return fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newToken}` }
      });
    }

    logout();
    return res;
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, authFetch, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
