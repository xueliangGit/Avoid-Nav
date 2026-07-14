'use client';

import { useEffect, useState } from 'react';
import {
  applyTheme,
  getStoredTheme,
  resolveIsDark,
  setStoredTheme,
  systemPrefersDark,
  type Theme,
} from '@/lib/theme';

export function useTheme(): { theme: Theme; isDark: boolean; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    setIsDark(applyTheme(stored));

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      setThemeState((cur) => {
        // 仅当当前为跟随系统时才跟随系统重新 apply；否则保持用户选择
        if (cur === 'system') {
          const dark = systemPrefersDark();
          document.documentElement.classList.toggle('dark', dark);
          setIsDark(dark);
        }
        return cur;
      });
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const setTheme = (t: Theme) => {
    setStoredTheme(t);
    setThemeState(t);
    setIsDark(applyTheme(t));
  };

  return { theme, isDark, setTheme };
}
