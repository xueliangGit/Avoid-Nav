// src/lib/storage/localStore.ts
import {
  HistoryStorage,
  SavedRoute,
  SavedRouteInput,
  SavedRoutePatch,
  StorageQuotaError,
} from './types';

const STORAGE_KEY = 'avoid-nav:history:v1';

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readFromStorage(): SavedRoute[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedRoute[]) : [];
  } catch {
    return [];
  }
}

function writeToStorage(routes: SavedRoute[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new StorageQuotaError();
    }
    throw err;
  }
}

function sortRoutes(routes: SavedRoute[]): SavedRoute[] {
  return [...routes].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

class LocalHistoryStorage implements HistoryStorage {
  private cache: SavedRoute[] = [];
  private listeners = new Set<() => void>();
  private hydrated = false;

  private hydrate() {
    if (this.hydrated) return;
    this.cache = sortRoutes(readFromStorage());
    this.hydrated = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== STORAGE_KEY) return;
        this.cache = sortRoutes(readFromStorage());
        this.emit();
      });
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private persist() {
    writeToStorage(this.cache);
    this.cache = sortRoutes(this.cache);
    this.emit();
  }

  list(): SavedRoute[] {
    this.hydrate();
    return this.cache;
  }

  get(id: string): SavedRoute | null {
    this.hydrate();
    return this.cache.find((r) => r.id === id) ?? null;
  }

  save(input: SavedRouteInput): SavedRoute {
    this.hydrate();
    const now = Date.now();
    const route: SavedRoute = {
      ...input,
      id: genId(),
      createdAt: now,
      updatedAt: now,
    };
    this.cache = [route, ...this.cache];
    this.persist();
    return route;
  }

  update(id: string, patch: SavedRoutePatch): SavedRoute {
    this.hydrate();
    const idx = this.cache.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`SavedRoute not found: ${id}`);
    const next: SavedRoute = {
      ...this.cache[idx]!,
      ...patch,
      id,
      updatedAt: Date.now(),
    };
    this.cache = [...this.cache];
    this.cache[idx] = next;
    this.persist();
    return next;
  }

  remove(id: string): void {
    this.hydrate();
    const before = this.cache.length;
    this.cache = this.cache.filter((r) => r.id !== id);
    if (this.cache.length !== before) this.persist();
  }

  subscribe(listener: () => void): () => void {
    this.hydrate();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export { LocalHistoryStorage };
