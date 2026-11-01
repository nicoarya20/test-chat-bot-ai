import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckIcon, CopyIcon } from "./icons";

const COPY_FEEDBACK_MS = 1500;

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = extractText(children);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  }
  return (
    <div className="group relative">
      <button type="button" onClick={copy} aria-label="Salin kode"
        className="absolute top-2 right-2 rounded-md border border-line bg-surface p-1.5 text-muted opacity-0 transition group-hover:opacity-100 hover:text-ink">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <pre className="overflow-x-auto rounded-xl border border-line bg-[var(--code-bg)] p-4 font-mono text-[0.85rem] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

/** Renders assistant markdown (GFM) with copyable code blocks; raw HTML is not rendered. */
export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
      a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
    }}>
      {text}
    </ReactMarkdown>
  );
}
