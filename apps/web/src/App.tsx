import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { RequireApproved } from "./components/RouteGuards";
import { SessionProvider } from "./hooks/session.context";
import { AdminPage } from "./pages/admin/AdminPage";
import { ChatLayout } from "./pages/ChatLayout";
import { ChatPage } from "./pages/ChatPage";
import { LoginPage } from "./pages/LoginPage";
import { NewChatPage } from "./pages/NewChatPage";
import { StatusPage } from "./pages/StatusPage";
import { UsagePage } from "./pages/UsagePage";

/** Route table: public login/status pages, everything else behind approval. */
export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pending" element={<StatusPage kind="pending" />} />
          <Route path="/rejected" element={<StatusPage kind="rejected" />} />
          <Route element={<RequireApproved><ChatLayout /></RequireApproved>}>
            <Route index element={<NewChatPage />} />
            <Route path="c/:id" element={<ChatPage />} />
            <Route path="usage" element={<UsagePage />} />
            <Route path="admin" element={<RequireApproved admin><AdminPage /></RequireApproved>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
