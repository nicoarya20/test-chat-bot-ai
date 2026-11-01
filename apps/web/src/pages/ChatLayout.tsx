import { useState } from "react";
import { Outlet, useOutletContext } from "react-router";
import { MenuIcon } from "../components/icons";
import { Sidebar } from "../components/Sidebar";
import { useSession } from "../hooks/session.context";
import { useConversations, type ConversationsApi } from "../hooks/useConversations";

interface LayoutContext { conversations: ConversationsApi }

/** Sidebar + content shell; the sidebar becomes a drawer on small screens. */
export function ChatLayout() {
  const { state } = useSession();
  const conversations = useConversations();
  const [open, setOpen] = useState(false);
  if (state.kind !== "ready") return null;

  return (
    <div className="flex h-full">
      <div className={`fixed inset-y-0 left-0 z-30 transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar user={state.me.user} conversations={conversations} onNavigate={() => setOpen(false)} />
      </div>
      {open && <button type="button" aria-label="Tutup menu" onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-black/30 md:hidden" />}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center p-2 md:hidden">
          <button type="button" aria-label="Buka menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-bubble"><MenuIcon /></button>
        </div>
        <Outlet context={{ conversations } satisfies LayoutContext} />
      </main>
    </div>
  );
}

/** Access the layout's shared conversation list from a child route. */
export const useLayout = () => useOutletContext<LayoutContext>();
