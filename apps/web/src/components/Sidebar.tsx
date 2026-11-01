import { NavLink, useNavigate } from "react-router";
import type { ConversationsApi } from "../hooks/useConversations";
import type { CurrentUser } from "../lib/api.types";
import { signOut } from "../lib/auth.client";
import { APP_NAME } from "../lib/copy";
import { LogoutIcon, PlusIcon, SettingsIcon, Spark, TrashIcon } from "./icons";

interface SidebarProps {
  user: CurrentUser;
  conversations: ConversationsApi;
  onNavigate: () => void;
}

/** Left rail: new chat, recent conversations, account actions. */
export function Sidebar({ user, conversations, onNavigate }: SidebarProps) {
  const navigate = useNavigate();

  async function remove(id: string, title: string) {
    if (!window.confirm(`Hapus percakapan "${title}"?`)) return;
    await conversations.remove(id);
    if (window.location.pathname === `/c/${id}`) navigate("/");
  }

  return (
    <nav className="flex h-full w-72 flex-col border-r border-line bg-sidebar">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Spark className="text-2xl" />
        <span className="font-serif text-xl">{APP_NAME}</span>
      </div>
      <div className="px-3">
        <NavLink to="/" onClick={onNavigate}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-accent-strong hover:bg-bubble">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent text-white"><PlusIcon className="size-3.5" /></span>
          Chat baru
        </NavLink>
      </div>
      <p className="px-6 pt-5 pb-1 text-xs font-medium text-muted">Terbaru</p>
      <ul className="flex-1 overflow-y-auto px-3 pb-3">
        {conversations.items.map((c) => (
          <li key={c.id} className="group relative">
            <NavLink to={`/c/${c.id}`} onClick={onNavigate}
              className={({ isActive }) => `block truncate rounded-lg py-1.5 pr-8 pl-3 text-sm ${isActive ? "bg-bubble text-ink" : "text-ink/80 hover:bg-bubble/70"}`}>
              {c.title}
            </NavLink>
            <button type="button" aria-label={`Hapus ${c.title}`} onClick={() => remove(c.id, c.title)}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-danger">
              <TrashIcon className="size-3.5" />
            </button>
          </li>
        ))}
        {conversations.hasMore && (
          <li><button type="button" onClick={() => void conversations.loadMore()}
            className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-muted hover:bg-bubble">Muat lebih banyak</button></li>
        )}
      </ul>
      <div className="border-t border-line p-3">
        {user.role === "admin" && (
          <NavLink to="/admin" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-bubble">
            <SettingsIcon /> Panel admin
          </NavLink>
        )}
        <div className="flex items-center gap-2 rounded-lg px-3 py-2">
          {user.image
            ? <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full" />
            : <span className="flex size-7 items-center justify-center rounded-full bg-ink text-xs text-bg">{user.name.slice(0, 1)}</span>}
          <span className="flex-1 truncate text-sm">{user.name}</span>
          <button type="button" onClick={() => void signOut()} aria-label="Keluar" className="rounded p-1 text-muted hover:text-ink">
            <LogoutIcon />
          </button>
        </div>
      </div>
    </nav>
  );
}
