import { Navigate } from "react-router";
import { Spark } from "../components/icons";
import { useSession } from "../hooks/session.context";
import { signOut } from "../lib/auth.client";

const CONTENT = {
  pending: {
    title: "Menunggu persetujuan admin",
    body: "Akunmu sudah terdaftar. Admin perlu menyetujuinya sebelum kamu bisa mulai mengobrol.",
  },
  rejected: {
    title: "Akses ditolak",
    body: "Admin tidak menyetujui akun ini. Hubungi admin jika menurutmu ini keliru.",
  },
} as const;

/** Shown to pending/rejected accounts; pending users can re-check without re-login. */
export function StatusPage({ kind }: { kind: keyof typeof CONTENT }) {
  const { state, refresh } = useSession();
  if (state.kind === "anonymous") return <Navigate to="/login" replace />;
  if (state.kind === "ready" && state.me.user.status === "approved") return <Navigate to="/" replace />;
  const content = CONTENT[kind];
  const email = state.kind === "ready" ? state.me.user.email : "";

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Spark className={`mb-6 text-5xl ${kind === "pending" ? "spark-spin" : ""}`} />
      <h1 className="mb-3 font-serif text-3xl">{content.title}</h1>
      <p className="mb-2 max-w-md text-muted">{content.body}</p>
      {email && <p className="mb-8 text-sm text-muted">Masuk sebagai <span className="text-ink">{email}</span></p>}
      <div className="flex gap-3">
        {kind === "pending" && (
          <button type="button" onClick={() => void refresh()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong">Cek lagi</button>
        )}
        <button type="button" onClick={() => void signOut()}
          className="rounded-xl border border-line px-4 py-2 text-sm hover:bg-bubble">Keluar</button>
      </div>
    </div>
  );
}
