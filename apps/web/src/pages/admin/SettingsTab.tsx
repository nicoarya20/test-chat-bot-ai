import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Input, Notice } from "../../components/ui";
import { api, ApiError, json } from "../../lib/api.client";
import type { AppSettings } from "../../lib/api.types";
import { errorText } from "../../lib/copy";

interface SettingsResponse { settings: AppSettings; supportedModels: string[] }

/** Model, system prompt and default token limits. */
export function SettingsTab() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<AppSettings | null>(null);
  const [notice, setNotice] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    void api<SettingsResponse>("/admin/settings").then((res) => { setData(res); setForm(res.settings); });
  }, []);
  if (!data || !form) return <p className="text-muted">Memuat…</p>;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    try {
      const res = await api<{ settings: AppSettings }>("/admin/settings", json("PUT", {
        model: form.model, systemPrompt: form.systemPrompt,
        defaultSessionTokenLimit: form.defaultSessionTokenLimit, defaultWeeklyTokenLimit: form.defaultWeeklyTokenLimit,
      }));
      setForm(res.settings);
      setNotice({ msg: "Pengaturan disimpan. Model dan system prompt berlaku untuk percakapan baru.", tone: "ok" });
    } catch (e) {
      setNotice({ msg: errorText(e instanceof ApiError ? e.code : undefined), tone: "error" });
    }
  }

  const num = (key: "defaultSessionTokenLimit" | "defaultWeeklyTokenLimit") => (value: string) =>
    setForm({ ...form, [key]: Math.max(0, Math.floor(Number(value) || 0)) });

  return (
    <Card>
      <form onSubmit={save} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Model</span>
          <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="w-64 rounded-lg border border-line bg-surface px-3 py-1.5">
            {data.supportedModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">System prompt</span>
          <textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={6}
            placeholder="Instruksi untuk model di setiap percakapan baru (opsional)"
            className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-muted" />
        </label>
        <div className="flex flex-wrap gap-6">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Default limit sesi 5 jam</span>
            <Input inputMode="numeric" value={form.defaultSessionTokenLimit} onChange={(e) => num("defaultSessionTokenLimit")(e.target.value)} className="w-40" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Default limit mingguan</span>
            <Input inputMode="numeric" value={form.defaultWeeklyTokenLimit} onChange={(e) => num("defaultWeeklyTokenLimit")(e.target.value)} className="w-40" />
          </label>
        </div>
        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary">Simpan</Button>
          {notice && <Notice tone={notice.tone}>{notice.msg}</Notice>}
        </div>
      </form>
    </Card>
  );
}
