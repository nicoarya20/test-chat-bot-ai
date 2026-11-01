import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, Input, Notice } from "../../components/ui";
import { api, ApiError, json } from "../../lib/api.client";
import type { ProviderKey } from "../../lib/api.types";
import { errorText } from "../../lib/copy";

/** Add, activate and delete Anthropic API keys (stored encrypted, shown as last 4). */
export function KeysTab() {
  const [items, setItems] = useState<ProviderKey[] | null>(null);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [notice, setNotice] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => setItems((await api<{ items: ProviderKey[] }>("/admin/keys")).items), []);
  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>, okMsg: string) {
    try {
      await action();
      setNotice({ msg: okMsg, tone: "ok" });
      await load();
    } catch (e) {
      setNotice({ msg: errorText(e instanceof ApiError ? e.code : undefined), tone: "error" });
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    await run(() => api("/admin/keys", json("POST", { label, apiKey })), "API key ditambahkan.");
    setApiKey("");
    setLabel("");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Tambah API key Anthropic">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <Input aria-label="Label" placeholder="Label, mis. Produksi" value={label} onChange={(e) => setLabel(e.target.value)} required className="w-48" />
          <Input aria-label="API key" type="password" autoComplete="off" placeholder="sk-ant-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required className="min-w-64 flex-1" />
          <Button type="submit" variant="primary">Simpan</Button>
        </form>
        <p className="mt-3 text-xs text-muted">Key dienkripsi di server dan tidak pernah ditampilkan lagi. Key pertama otomatis aktif.</p>
      </Card>
      {notice && <Notice tone={notice.tone}>{notice.msg}</Notice>}
      <Card title="Key tersimpan">
        {!items ? <p className="text-muted">Memuat…</p> : items.length === 0 ? <p className="text-muted">Belum ada key. Chat tidak bisa dipakai sampai ada key aktif.</p> : (
          <ul className="divide-y divide-line">
            {items.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="font-medium">{k.label} {k.isActive && <span className="ml-2 rounded bg-accent/15 px-1.5 text-xs text-accent-strong">aktif</span>}</div>
                  <div className="font-mono text-xs text-muted">••••{k.last4}</div>
                </div>
                {!k.isActive && <Button onClick={() => run(() => api(`/admin/keys/${k.id}/activate`, { method: "POST" }), "Key diaktifkan.")}>Aktifkan</Button>}
                <Button variant="danger" onClick={() => { if (window.confirm(`Hapus key "${k.label}"?`)) void run(() => api(`/admin/keys/${k.id}`, { method: "DELETE" }), "Key dihapus."); }}>Hapus</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
