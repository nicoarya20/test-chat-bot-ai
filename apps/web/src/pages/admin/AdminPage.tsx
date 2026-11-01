import { useState } from "react";
import { KeysTab } from "./KeysTab";
import { SettingsTab } from "./SettingsTab";
import { UsersTab } from "./UsersTab";

const TABS = [
  { id: "users", label: "Pengguna" },
  { id: "settings", label: "Pengaturan" },
  { id: "keys", label: "API Key" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Admin panel with users, chat settings and API key management. */
export function AdminPage() {
  const [tab, setTab] = useState<TabId>("users");
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="mb-6 font-serif text-3xl">Panel admin</h1>
        <div role="tablist" className="mb-6 flex gap-1 border-b border-line">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "users" && <UsersTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "keys" && <KeysTab />}
      </div>
    </div>
  );
}
