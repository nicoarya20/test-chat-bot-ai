# Changelog

## [0.1.0] - 2026-11-01
### Added
- Claude-style chat UI: conversation sidebar, streaming replies, markdown and code blocks, light/dark theme.
- Google sign-in. New accounts wait for admin approval; emails in `ADMIN_EMAILS` become admins automatically.
- Admin panel: approve or reject users, set per-user token limits, choose the model and system prompt, and manage Anthropic API keys (encrypted at rest, shown only as the last 4 characters).
- Token limits per user: a 5-hour session window plus a weekly cap that resets Monday 00:00 (WIB by default).
- Local PostgreSQL schema and migrations.
