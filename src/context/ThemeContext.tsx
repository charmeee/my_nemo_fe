import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('nemo-theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('nemo-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = () => setIsDark((v) => !v);

  return <ThemeContext.Provider value={{ isDark, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
