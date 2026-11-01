import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { COMPOSER_PLACEHOLDER } from "../lib/copy";
import { ArrowUpIcon } from "./icons";

const MAX_TEXTAREA_PX = 240;

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Rounded auto-growing input. Enter sends, Shift+Enter adds a newline. */
export function Composer({ onSend, disabled = false, placeholder = COMPOSER_PLACEHOLDER, autoFocus = false }: ComposerProps) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [text]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  }

  return (
    <form onSubmit={submit}
      className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] focus-within:border-muted/50">
      <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
        rows={1} autoFocus={autoFocus} placeholder={placeholder} aria-label="Pesan"
        className="max-h-60 flex-1 resize-none bg-transparent px-1 py-1.5 text-[0.95rem] text-ink outline-none placeholder:text-muted" />
      <button type="submit" disabled={disabled || !text.trim()} aria-label="Kirim"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-strong disabled:opacity-40">
        <ArrowUpIcon />
      </button>
    </form>
  );
}
