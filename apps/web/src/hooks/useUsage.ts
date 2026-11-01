import { useEffect, useState } from "react";
import { api } from "../lib/api.client";

export const USAGE_RANGES = [7, 30, 90] as const;
export type UsageRange = (typeof USAGE_RANGES)[number];

/** Fetches a usage endpoint for a day range, keeping the previous data visible while refetching. */
export function useUsage<T>(path: "/me/usage" | "/admin/usage", days: UsageRange) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<T>(`${path}?days=${days}`)
      .then((result) => { if (!cancelled) { setData(result); setError(null); } })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, days]);

  return { data, loading, error };
}
