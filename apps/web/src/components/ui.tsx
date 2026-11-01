import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  secondary: "border border-line bg-surface hover:bg-bubble",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

/** Small button with brand variants. */
export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...props}
    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${VARIANT[variant]} ${className}`} />;
}

/** Text input matching the composer's look. */
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props}
    className={`rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted ${className}`} />;
}

/** Bordered panel with an optional heading. */
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      {title && <h2 className="mb-4 font-serif text-xl">{title}</h2>}
      {children}
    </section>
  );
}

/** Inline success/error feedback line. */
export function Notice({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return <p role="status" className={`text-sm ${tone === "ok" ? "text-muted" : "text-danger"}`}>{children}</p>;
}
