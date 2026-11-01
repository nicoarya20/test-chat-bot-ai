import { useEffect, useState } from "react";
import { Button, Card, Notice } from "../../components/ui";
import { api, ApiError, json } from "../../lib/api.client";
import type { AdminModelsResponse } from "../../lib/api.types";
import { errorText, MODEL_TEXT } from "../../lib/copy";
import { modelDetails, modelName } from "../../lib/model.format";

/** Free OpenRouter models: pick the default and which ones users may choose. */
export function ModelsSection() {
  const [data, setData] = useState<AdminModelsResponse | null>(null);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [defaultModel, setDefaultModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    api<AdminModelsResponse>("/admin/models")
      .then((res) => { setData(res); setAllowed(new Set(res.allowed)); setDefaultModel(res.defaultModel); })
      .catch((e: unknown) => setNotice({ msg: errorText(e instanceof ApiError ? e.code : undefined), tone: "error" }));
  }, []);

  if (!data) return <Card title={MODEL_TEXT.adminTitle}>{notice ? <Notice tone="error">{notice.msg}</Notice> : <p className="text-muted">Memuat…</p>}</Card>;
  const defaultIsFree = data.free.some((m) => m.id === defaultModel);

  function toggle(id: string) {
    setAllowed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setNotice(null);
    try {
      await api("/admin/models/allowed", json("PUT", { models: [...allowed].filter((id) => id !== defaultModel) }));
      if (defaultModel !== data.defaultModel) await api("/admin/settings", json("PUT", { model: defaultModel }));
      setData({ ...data, defaultModel, allowed: [...allowed] });
      setNotice({ msg: MODEL_TEXT.saved, tone: "ok" });
    } catch (e) {
      setNotice({ msg: errorText(e instanceof ApiError ? e.code : undefined), tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title={MODEL_TEXT.adminTitle}>
      <p className="mb-4 text-xs text-muted">{MODEL_TEXT.adminHint}</p>
      {!defaultIsFree && <div className="mb-4"><Notice tone="error">{errorText("model_not_free")} ({defaultModel})</Notice></div>}
      <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface text-xs text-muted">
            <tr>
              <th className="p-2 text-left">Model</th>
              <th className="p-2 text-center">{MODEL_TEXT.defaultColumn}</th>
              <th className="p-2 text-center">{MODEL_TEXT.allowColumn}</th>
            </tr>
          </thead>
          <tbody>
            {data.free.map((m) => {
              const isDefault = m.id === defaultModel;
              return (
                <tr key={m.id} className="border-t border-line">
                  <td className="p-2">
                    <div className="font-medium">{modelName(m)}</div>
                    <div className="font-mono text-xs text-muted">{m.id}</div>
                    <div className="text-xs text-muted">{modelDetails(m, MODEL_TEXT.image)}</div>
                  </td>
                  <td className="p-2 text-center">
                    <input type="radio" name="default-model" checked={isDefault} onChange={() => setDefaultModel(m.id)}
                      aria-label={`${MODEL_TEXT.defaultColumn}: ${m.id}`} className="accent-accent" />
                  </td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={isDefault || allowed.has(m.id)} disabled={isDefault} onChange={() => toggle(m.id)}
                      aria-label={`${MODEL_TEXT.allowColumn}: ${m.id}`} className="accent-accent" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Button type="button" variant="primary" disabled={saving || !defaultIsFree} onClick={() => void save()}>Simpan model</Button>
        {notice && <Notice tone={notice.tone}>{notice.msg}</Notice>}
      </div>
    </Card>
  );
}
