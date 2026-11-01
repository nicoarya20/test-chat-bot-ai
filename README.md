# Chat — Claude-style chatbot

Chat web app with a Claude-like UI. Users sign in with Google; new accounts wait for
admin approval. Admins manage the Anthropic API key, the model, the system prompt, and
per-user token limits (a 5-hour session window plus a weekly cap).

## Stack

| Part | Tech |
|---|---|
| Web (`apps/web`) | Vite, React 19, React Router, Tailwind CSS v4 |
| Server (`apps/server`) | Bun, Hono, Better Auth (Google), Drizzle ORM |
| Database | Local PostgreSQL |
| AI | `@anthropic-ai/sdk` (streaming, server-side refusal fallback) |

In development the browser only talks to Vite (`:5173`), which proxies `/api` to the
server (`:3000`), so cookies and OAuth stay same-origin.

## Setup

1. **Install:** `bun install`
2. **Databases:** create a dev DB and a separate test DB, e.g.
   `createdb -p 5433 chatbot_dev && createdb -p 5433 chatbot_test`
3. **Env:** `cp apps/server/.env.example apps/server/.env`, then fill it in:
   - `BETTER_AUTH_SECRET`: `openssl rand -base64 48`
   - `KEY_ENCRYPTION_KEY`: `openssl rand -base64 32` (encrypts stored API keys; changing it makes saved keys unreadable)
   - `ADMIN_EMAILS`: comma-separated emails that become approved admins on first sign-in
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: see below. These must be in `apps/server/.env`; a root `.env` is not read by the server.
4. **Migrate:** `bun run db:migrate`
5. **Run:** `bun run dev` (starts server and web together; `dev:server` / `dev:web` run them separately), then open http://localhost:5173

### Google OAuth

In Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (Web application):

- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI: `http://localhost:5173/api/auth/callback/google`

### First run

Sign in with an email listed in `ADMIN_EMAILS`, open **Panel admin → API Key**, and add an
Anthropic key. Chat stays unavailable until a key is active.

## How limits work

- **Session (5 hours):** a window opens at a user's first message and lasts `SESSION_WINDOW_HOURS`. When it ends, the next message opens a new window with a full allowance.
- **Weekly:** resets every Monday 00:00 at `QUOTA_TZ_OFFSET_MINUTES` (default 420 = WIB; use 480 for WITA).
- Both must have room before a message is sent. Usage is input + output + cache tokens, as reported by Anthropic.
- A reply that starts is allowed to finish (`max_tokens` never drops below `CHAT_MIN_OUTPUT_TOKENS`), so a user can go slightly over; the next message is then blocked.
- Limits are per user. An empty value falls back to the defaults in **Panel admin → Pengaturan**.

The model and system prompt are frozen per conversation. Changing them affects new
conversations only, because replaying history to a different prompt would invalidate
Claude's stored thinking blocks.

## Tests

```bash
bun run test        # server (needs TEST_DATABASE_URL) + web
bun run typecheck
```

Server tests run against `TEST_DATABASE_URL`, apply migrations automatically, and refuse to
run if it equals `DATABASE_URL`. The model is faked in tests, so no API calls are made.

## API overview

All routes are under `/api` and require a session unless noted.

| Method & path | Who | Purpose |
|---|---|---|
| `GET /health` | public | Liveness |
| `/auth/*` | public | Better Auth (Google sign-in, sign-out) |
| `GET /me` | any signed-in | Current user and quota |
| `GET/POST /conversations` | approved | List (`limit`, `offset`) / create |
| `GET /conversations/:id/messages` | approved | Messages (paginated) |
| `PATCH/DELETE /conversations/:id` | approved | Rename / delete |
| `POST /conversations/:id/messages` | approved | Send; SSE events `delta`, `done`, `error`, `ping` |
| `GET /admin/users`, `PATCH /admin/users/:id` | admin | Approve/reject, role, limits |
| `GET/PUT /admin/settings` | admin | Model, system prompt, default limits |
| `GET/POST /admin/keys`, `POST /admin/keys/:id/activate`, `DELETE /admin/keys/:id` | admin | API keys (write-only secrets) |
