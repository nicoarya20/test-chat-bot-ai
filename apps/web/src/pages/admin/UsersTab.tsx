import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Notice } from "../../components/ui";
import { api, ApiError, json } from "../../lib/api.client";
import type { AdminUser, UserStatus } from "../../lib/api.types";
import { errorText, STATUS_TEXT } from "../../lib/copy";
import { formatTokens } from "../../lib/quota.format";

const PAGE_SIZE = 20;
const FILTERS: Array<{ value: UserStatus | ""; label: string }> = [
  { value: "pending", label: "Menunggu" }, { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" }, { value: "", label: "Semua" },
];

const toLimit = (raw: string): number | null => (raw.trim() === "" ? null : Math.max(0, Math.floor(Number(raw))));

function UserRow({ u, onSaved }: { u: AdminUser; onSaved: (msg: string, tone: "ok" | "error") => void }) {
  const [session, setSession] = useState(u.sessionTokenLimit?.toString() ?? "");
  const [weekly, setWeekly] = useState(u.weeklyTokenLimit?.toString() ?? "");

  async function patch(body: object, message: string) {
    try {
      await api(`/admin/users/${u.id}`, json("PATCH", body));
      onSaved(message, "ok");
    } catch (e) {
      onSaved(errorText(e instanceof ApiError ? e.code : undefined), "error");
    }
  }

  return (
    <tr className="border-t border-line align-top">
      <td className="py-3 pr-3">
        <div className="font-medium">{u.name}{u.role === "admin" && <span className="ml-2 rounded bg-accent/15 px-1.5 text-xs text-accent-strong">admin</span>}</div>
        <div className="text-xs text-muted">{u.email}</div>
      </td>
      <td className="py-3 pr-3 text-sm">{STATUS_TEXT[u.status]}</td>
      <td className="py-3 pr-3 text-sm text-muted">
        Sesi {formatTokens(u.sessionUsed)}<br />Minggu {formatTokens(u.weeklyUsed)}
      </td>
      <td className="py-3 pr-3">
        <div className="flex flex-col gap-1.5">
          <Input aria-label="Limit sesi" inputMode="numeric" placeholder="default" value={session} onChange={(e) => setSession(e.target.value)} className="w-32" />
          <Input aria-label="Limit mingguan" inputMode="numeric" placeholder="default" value={weekly} onChange={(e) => setWeekly(e.target.value)} className="w-32" />
          <Button onClick={() => patch({ sessionTokenLimit: toLimit(session), weeklyTokenLimit: toLimit(weekly) }, "Limit disimpan.")}>Simpan limit</Button>
        </div>
      </td>
      <td className="py-3">
        <div className="flex flex-col gap-1.5">
          {u.status !== "approved" && <Button variant="primary" onClick={() => patch({ status: "approved" }, "Pengguna disetujui.")}>Setujui</Button>}
          {u.status !== "rejected" && <Button variant="danger" onClick={() => patch({ status: "rejected" }, "Pengguna ditolak.")}>Tolak</Button>}
        </div>
      </td>
    </tr>
  );
}

/** Approve/reject accounts and set per-user token limits (empty = default). */
export function UsersTab() {
  const [filter, setFilter] = useState<UserStatus | "">("pending");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ users: AdminUser[]; total: number } | null>(null);
  const [notice, setNotice] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    const status = filter ? `&status=${filter}` : "";
    setData(await api(`/admin/users?limit=${PAGE_SIZE}&offset=${offset}${status}`));
  }, [filter, offset]);
  useEffect(() => { void load(); }, [load]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f.label} variant={filter === f.value ? "primary" : "secondary"} onClick={() => { setFilter(f.value); setOffset(0); }}>{f.label}</Button>
        ))}
      </div>
      {notice && <div className="mb-3"><Notice tone={notice.tone}>{notice.msg}</Notice></div>}
      {!data ? <p className="text-muted">Memuat…</p> : data.users.length === 0 ? <p className="text-muted">Tidak ada pengguna.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs text-muted"><tr><th className="pb-2">Pengguna</th><th className="pb-2">Status</th><th className="pb-2">Pemakaian</th><th className="pb-2">Limit (token)</th><th className="pb-2">Aksi</th></tr></thead>
            <tbody>{data.users.map((u) => <UserRow key={`${u.id}-${u.status}`} u={u} onSaved={(msg, tone) => { setNotice({ msg, tone }); void load(); }} />)}</tbody>
          </table>
        </div>
      )}
      {data && data.total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} dari {data.total}</span>
          <div className="flex gap-2">
            <Button disabled={offset === 0} onClick={() => setOffset(offset - PAGE_SIZE)}>Sebelumnya</Button>
            <Button disabled={offset + PAGE_SIZE >= data.total} onClick={() => setOffset(offset + PAGE_SIZE)}>Berikutnya</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
