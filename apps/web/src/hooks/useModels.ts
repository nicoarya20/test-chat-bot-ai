import { useEffect, useState } from "react";
import { api } from "../lib/api.client";
import type { UserModelsResponse } from "../lib/api.types";

/** Models the user may pick; null until loaded (or if the list is unavailable). */
export function useModels(): UserModelsResponse | null {
  const [data, setData] = useState<UserModelsResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<UserModelsResponse>("/models")
      .then((res) => { if (!cancelled) setData(res); })
      // Picker just stays hidden; the send path reports catalog errors itself.
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, []);
  return data;
}
