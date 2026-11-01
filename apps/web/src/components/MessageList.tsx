import { useEffect, useRef } from "react";
import { Markdown } from "./Markdown";
import { Spark } from "./icons";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  error?: string;
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl bg-bubble px-4 py-2.5 whitespace-pre-wrap break-words text-[0.95rem]">{text}</div>
    </div>
  );
}

function AssistantMessage({ message }: { message: DisplayMessage }) {
  const waiting = message.streaming && !message.text;
  return (
    <div className="flex gap-3">
      <Spark className={`mt-1 text-lg ${message.streaming ? "spark-spin" : ""}`} />
      <div className="min-w-0 flex-1">
        {waiting && <p className="font-serif text-muted italic">Berpikir…</p>}
        {message.text && (
          <div className={`prose-chat break-words ${message.streaming ? "caret" : ""}`}>
            <Markdown text={message.text} />
          </div>
        )}
        {message.error && (
          <p role="alert" className="mt-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{message.error}</p>
        )}
      </div>
    </div>
  );
}

/** Conversation transcript; keeps the view pinned to the newest message while streaming. */
export function MessageList({ messages }: { messages: DisplayMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = messages.at(-1);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, last?.text]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      {messages.map((m) => (m.role === "user" ? <UserMessage key={m.id} text={m.text} /> : <AssistantMessage key={m.id} message={m} />))}
      <div ref={endRef} />
    </div>
  );
}
