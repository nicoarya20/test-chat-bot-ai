import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../lib/api.client";
import type { MeResponse, QuotaStatus } from "../lib/api.types";

type SessionState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "error"; message: string }
  | { kind: "ready"; me: MeResponse };

interface SessionValue {
  state: SessionState;
  refresh: () => Promise<void>;
  setQuota: (quota: QuotaStatus) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Loads /api/me once and exposes it (plus quota updates) to the tree. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ kind: "loading" });

  const refresh = useCallback(async () => {
    try {
      setState({ kind: "ready", me: await api<MeResponse>("/me") });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setState({ kind: "anonymous" });
      else setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const setQuota = useCallback((quota: QuotaStatus) => {
    setState((s) => (s.kind === "ready" ? { kind: "ready", me: { ...s.me, quota } } : s));
  }, []);

  return <SessionContext.Provider value={{ state, refresh, setQuota }}>{children}</SessionContext.Provider>;
}

/** Access the session; must be used under SessionProvider. */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
