// Inline SVG icons (stroke = currentColor) to avoid an icon-library dependency.
type IconProps = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const PlusIcon = ({ className = "size-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 5v14M5 12h14" /></svg>
);
export const ArrowUpIcon = ({ className = "size-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.2}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
);
export const TrashIcon = ({ className = "size-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
export const MenuIcon = ({ className = "size-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
export const CopyIcon = ({ className = "size-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
);
export const CheckIcon = ({ className = "size-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M5 12l5 5L20 7" /></svg>
);
export const SettingsIcon = ({ className = "size-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const LogoutIcon = ({ className = "size-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" /></svg>
);

/** The brand spark mark. */
export const Spark = ({ className = "" }: IconProps) => (
  <span aria-hidden className={`text-accent select-none ${className}`}>✻</span>
);
