export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'avoid-nav:theme:v1';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const t = window.localStorage.getItem(STORAGE_KEY);
  if (t === 'light' || t === 'dark' || t === 'system') return t;
  return 'system';
}

export function setStoredTheme(t: Theme): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, t);
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveIsDark(t: Theme): boolean {
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return systemPrefersDark();
}

export function applyTheme(t: Theme): boolean {
  const isDark = resolveIsDark(t);
  document.documentElement.classList.toggle('dark', isDark);
  return isDark;
}
