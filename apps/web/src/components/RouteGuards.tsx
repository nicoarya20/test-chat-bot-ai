import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useSession } from "../hooks/session.context";
import { Spark } from "./icons";

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center p-6 text-center text-muted">{children}</div>;
}

/** Renders children only for approved users; routes others to login/pending/rejected. */
export function RequireApproved({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { state } = useSession();
  if (state.kind === "loading") return <FullScreen><Spark className="spark-spin text-3xl" /></FullScreen>;
  if (state.kind === "error") return <FullScreen>Tidak bisa memuat sesi: {state.message}</FullScreen>;
  if (state.kind === "anonymous") return <Navigate to="/login" replace />;
  const { user } = state.me;
  if (user.status === "pending") return <Navigate to="/pending" replace />;
  if (user.status === "rejected") return <Navigate to="/rejected" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}
