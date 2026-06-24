import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: false, toggle: () => {} });

// 다크/라이트 테마 상태 Provider (localStorage + OS prefers-color-scheme 동기화)
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('nemo-theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // html.dark 클래스 토글 + localStorage 영속화
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('nemo-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = () => setIsDark((v) => !v);

  return <ThemeContext.Provider value={{ isDark, toggle }}>{children}</ThemeContext.Provider>;
}

// 테마 컨텍스트 훅
export const useTheme = () => useContext(ThemeContext);
