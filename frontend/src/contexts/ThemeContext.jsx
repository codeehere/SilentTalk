import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

const THEMES = ['dark', 'light', 'cosmic', 'ocean'];

export function ThemeProvider({ children }) {
  const { user, updateUser, authFetch, API } = useAuth();
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('st_theme') || user?.settings?.theme || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('st_theme', theme);
  }, [theme]);

  const setTheme = async (newTheme) => {
    if (!THEMES.includes(newTheme)) return;
    setThemeState(newTheme);
    if (user) {
      try {
        await authFetch(`${API}/api/auth/me`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: { theme: newTheme } })
        });
        updateUser({ settings: { ...user.settings, theme: newTheme } });
      } catch {}
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
