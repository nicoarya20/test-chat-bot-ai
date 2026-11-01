# Changelog

## [Unreleased]
### Added
- "Pemakaian" page (sidebar link) showing your token usage: today/week/month totals, 5-hour and weekly limit meters with reset times, a daily input/output chart (7/30/90 days, with a table view) and a per-model breakdown.
- Admin panel "Pemakaian" tab with usage across all users, including the top 10 users.
- API endpoints `GET /api/me/usage` and `GET /api/admin/usage`.
- Model picker in the chat box: users choose, per conversation, from free models the admin allows. Token limits stay the same whichever model is used.
- Admin "Model gratis" list in Pengaturan, loaded live from OpenRouter (free models only): set the default and which models users may pick.

### Changed
- Only free OpenRouter models can be used. Paid slugs are rejected when saving, and every message re-checks: a model that stopped being free falls back to the default, and chat stops with an error if the default is no longer free.
- The free-text model slug field in Pengaturan was replaced by the free model list.
- New optional env `MODEL_CATALOG_TTL_MS` (default 1 hour). Run `bun run db:migrate` (adds `allowed_models` and `conversations.model`).

## [0.2.0] - 2026-11-01
### Changed
- The chatbot now runs on OpenRouter instead of Anthropic. Admins add an OpenRouter API key and can pick any OpenRouter model by its slug.
- The default model is `nvidia/nemotron-3-ultra-550b-a55b:free` (no cost; rate-limited).
- Changing the model or system prompt now applies from the next message, including in existing conversations.
- Clearer errors when OpenRouter credits run out or the chosen model is unavailable.
- `bun run dev` starts the server and the web app together.

### Removed
- The Anthropic SDK and Anthropic-specific settings (`CHAT_EFFORT`). Optional `CHAT_REASONING_EFFORT` replaces it.

## [0.1.0] - 2026-11-01
### Added
- Claude-style chat UI: conversation sidebar, streaming replies, markdown and code blocks, light/dark theme.
- Google sign-in. New accounts wait for admin approval; emails in `ADMIN_EMAILS` become admins automatically.
- Admin panel: approve or reject users, set per-user token limits, choose the model and system prompt, and manage Anthropic API keys (encrypted at rest, shown only as the last 4 characters).
- Token limits per user: a 5-hour session window plus a weekly cap that resets Monday 00:00 (WIB by default).
- Local PostgreSQL schema and migrations.
