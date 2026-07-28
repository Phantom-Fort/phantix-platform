import { useCallback, useEffect, useState } from "react";
import { DEMO_MODE } from "./api";

export type ResourceState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  demo: boolean;
};

const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;

export function useResource<T>(loader: () => Promise<T>, initial: T): ResourceState<T> {
  const cacheKey = typeof loader === "function" ? String(loader) : undefined;
  const [data, setData] = useState<T>(() => {
    if (cacheKey && _cache.has(cacheKey)) return _cache.get(cacheKey)!.data as T;
    return initial;
  });
  const [loading, setLoading] = useState(() => !(cacheKey && _cache.has(cacheKey)));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const demo = DEMO_MODE;

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const hadCached = cacheKey && _cache.has(cacheKey);
    if (!hadCached) setLoading(true);
    setError(null);
    loader()
      .then((value) => {
        if (!cancelled) { setData(value); if (cacheKey) _cache.set(cacheKey, { data: value, ts: Date.now() }); }
      })
      .catch((err: unknown) => {
        if (!cancelled && !hadCached) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick, demo]);

  return { data, loading, error, refresh, demo };
}

if (typeof window !== "undefined") {
  setInterval(() => { const now = Date.now(); for (const [k, v] of _cache) { if (now - v.ts > CACHE_TTL) _cache.delete(k); } }, 30_000);
}
