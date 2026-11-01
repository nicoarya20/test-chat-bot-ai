import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Composer } from "../components/Composer";
import { MessageList, type DisplayMessage } from "../components/MessageList";
import { ModelPicker } from "../components/ModelPicker";
import { QuotaMeter } from "../components/QuotaMeter";
import { useModels } from "../hooks/useModels";
import { useSession } from "../hooks/session.context";
import { api, ApiError, json } from "../lib/api.client";
import type { ChatMessage } from "../lib/api.types";
import { streamMessage } from "../lib/chat.stream";
import { errorText, MODEL_TEXT } from "../lib/copy";
import { useLayout } from "./ChatLayout";

/** A conversation: loads history, streams replies, forwards a first message from /. */
export function ChatPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, setQuota, refresh } = useSession();
  const { conversations } = useLayout();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const sentPending = useRef<string | null>(null);
  const models = useModels();
  // Conversation's stored model; null = admin default.
  const [model, setModel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function changeModel(next: string | null) {
    const previous = model;
    setModel(next);
    setNotice(null);
    try {
      await api(`/conversations/${id}`, json("PATCH", { model: next }));
    } catch (e) {
      setModel(previous);
      setNotice(errorText(e instanceof ApiError ? e.code : undefined));
    }
  }

  const patchLast = (update: (m: DisplayMessage) => DisplayMessage) =>
    setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? update(m) : m)));

  const send = useCallback(async (text: string) => {
    setStreaming(true);
    const now = Date.now();
    setMessages((prev) => [...prev,
      { id: `local-user-${now}`, role: "user", text },
      { id: `local-assistant-${now}`, role: "assistant", text: "", streaming: true }]);
    await streamMessage(id, text, {
      onDelta: (delta) => patchLast((m) => ({ ...m, text: m.text + delta })),
      onDone: ({ quota, fellBack }) => {
        patchLast((m) => ({ ...m, streaming: false }));
        if (fellBack) { setModel(null); setNotice(MODEL_TEXT.fellBack); }
        setQuota(quota);
        void conversations.refresh();
      },
      onError: (err) => {
        patchLast((m) => ({ ...m, streaming: false, error: errorText(err.code) }));
        if (err.code === "quota_exceeded") void refresh();
      },
    });
    setStreaming(false);
  }, [id, setQuota, refresh, conversations]);

  useEffect(() => {
    setLoadError(null);
    setNotice(null);
    const pending = location.state as { pendingText?: string; model?: string | null } | null;
    const pendingText = pending?.pendingText;
    if (pendingText) {
      // Fresh conversation from the landing page: nothing to load, send once.
      // The ref guard (not a state reset) keeps StrictMode's double effect from
      // wiping or re-sending the optimistic messages.
      if (sentPending.current !== id) {
        sentPending.current = id;
        setMessages([]);
        setModel(pending?.model ?? null);
        navigate(location.pathname, { replace: true, state: null });
        void send(pendingText);
      }
      return;
    }
    let cancelled = false;
    setMessages([]);
    api<{ items: ChatMessage[]; conversation: { model: string | null } }>(`/conversations/${id}/messages`)
      .then((page) => { if (!cancelled) { setMessages(page.items); setModel(page.conversation.model); } })
      .catch((e: unknown) => { if (!cancelled) setLoadError(errorText(e instanceof ApiError ? e.code : undefined)); });
    return () => { cancelled = true; };
    // Re-run only when the conversation changes: location.state is consumed once
    // and cleared above, and `send` is recreated for the same id.
  }, [id]);

  if (state.kind !== "ready") return null;
  const quota = state.me.quota;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        {loadError ? <p className="p-8 text-center text-danger">{loadError}</p> : <MessageList messages={messages} />}
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-2 px-4 pb-4">
        {notice && <p role="status" className="text-center text-xs text-muted">{notice}</p>}
        <Composer onSend={send} disabled={streaming || quota?.allowed === false}
          toolbar={<ModelPicker models={models} value={model} onChange={(m) => void changeModel(m)} disabled={streaming} />} />
        <QuotaMeter quota={quota} />
      </div>
    </div>
  );
}
