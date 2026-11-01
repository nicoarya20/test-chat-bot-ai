import { useState } from "react";
import { useNavigate } from "react-router";
import { Composer } from "../components/Composer";
import { ModelPicker } from "../components/ModelPicker";
import { Spark } from "../components/icons";
import { QuotaMeter } from "../components/QuotaMeter";
import { useModels } from "../hooks/useModels";
import { useSession } from "../hooks/session.context";
import { api, ApiError, json } from "../lib/api.client";
import { errorText, NEW_CHAT_PLACEHOLDER } from "../lib/copy";
import { useLayout } from "./ChatLayout";

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

/** Landing view: greeting + centered composer; first message creates the conversation. */
export function NewChatPage() {
  const { state } = useSession();
  const { conversations } = useLayout();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const models = useModels();
  // null = admin default model.
  const [model, setModel] = useState<string | null>(null);
  if (state.kind !== "ready") return null;
  const { user, quota } = state.me;

  async function start(text: string) {
    setCreating(true);
    setError(null);
    try {
      const conv = await api<{ id: string }>("/conversations", json("POST", { title: text, model }));
      void conversations.refresh();
      navigate(`/c/${conv.id}`, { state: { pendingText: text, model } });
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : undefined));
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
      <h1 className="mb-8 flex items-center gap-3 text-center font-serif text-3xl text-ink md:text-4xl">
        <Spark className="text-4xl" /> {greeting()}, {user.name.split(" ")[0]}
      </h1>
      <div className="w-full max-w-2xl space-y-3">
        <Composer onSend={start} disabled={creating || quota?.allowed === false} placeholder={NEW_CHAT_PLACEHOLDER} autoFocus
          toolbar={<ModelPicker models={models} value={model} onChange={setModel} disabled={creating} />} />
        {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
        <QuotaMeter quota={quota} />
      </div>
    </div>
  );
}
