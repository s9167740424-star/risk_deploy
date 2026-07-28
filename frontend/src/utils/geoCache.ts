const PREFIX = 'atlas.geo.';
const VERSION = 'v1';

export const TTL = {
  lookup: 24 * 60 * 60 * 1000,
  offices: 24 * 60 * 60 * 1000,
  cadastral: 60 * 60 * 1000,
} as const;

export type CacheKind = keyof typeof TTL;

interface CacheEntry<T> {
  value: T;
  savedAt: number;
  ttl: number;
}

const MAX_ENTRIES = 60;

function isAvailable(): boolean {
  try {
    const probe = `${PREFIX}probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const available = typeof window !== 'undefined' && isAvailable();

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildKey(kind: CacheKind, query: string): string {
  return `${PREFIX}${VERSION}.${kind}.${normalizeQuery(query)}`;
}

export function coordsKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export function readCache<T>(kind: CacheKind, query: string): T | null {
  if (!available || !query) return null;

  try {
    const raw = window.localStorage.getItem(buildKey(kind, query));
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;

    if (Date.now() - entry.savedAt > entry.ttl) {
      window.localStorage.removeItem(buildKey(kind, query));
      return null;
    }

    return entry.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(kind: CacheKind, query: string, value: T): void {
  if (!available || !query) return;

  const entry: CacheEntry<T> = {
    value,
    savedAt: Date.now(),
    ttl: TTL[kind],
  };

  const key = buildKey(kind, query);
  const payload = JSON.stringify(entry);

  try {
    window.localStorage.setItem(key, payload);
    return;
  } catch {

  }

  const entries = listEntries();

  for (const old of entries) {
    window.localStorage.removeItem(old.key);
    try {
      window.localStorage.setItem(key, payload);
      return;
    } catch {

    }
  }
}

function listEntries(): Array<{ key: string; savedAt: number }> {
  const entries: Array<{ key: string; savedAt: number }> = [];

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;

    let savedAt = 0;
    try {
      savedAt = JSON.parse(window.localStorage.getItem(key) || '{}').savedAt || 0;
    } catch {
      savedAt = 0;
    }
    entries.push({ key, savedAt });
  }

  return entries.sort((a, b) => a.savedAt - b.savedAt);
}

export function pruneCache(): void {
  if (!available) return;

  const now = Date.now();
  const entries: Array<{ key: string; savedAt: number }> = [];

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;

    try {
      const raw = window.localStorage.getItem(key);
      const entry = JSON.parse(raw || '{}') as CacheEntry<unknown>;

      if (!entry.savedAt || now - entry.savedAt > (entry.ttl || 0)) {
        window.localStorage.removeItem(key);
        continue;
      }
      entries.push({ key, savedAt: entry.savedAt });
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  if (entries.length > MAX_ENTRIES) {
    entries
      .sort((a, b) => a.savedAt - b.savedAt)
      .slice(0, entries.length - MAX_ENTRIES)
      .forEach((e) => window.localStorage.removeItem(e.key));
  }
}

export function clearCache(): void {
  if (!available) return;

  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}

export function cacheAgeMinutes(kind: CacheKind, query: string): number | null {
  if (!available || !query) return null;

  try {
    const raw = window.localStorage.getItem(buildKey(kind, query));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    return Math.floor((Date.now() - entry.savedAt) / 60000);
  } catch {
    return null;
  }
}
