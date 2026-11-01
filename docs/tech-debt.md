# Tech debt & backlog

Known gaps and deferred ideas, so they are tracked instead of forgotten. Newest first.

## Model choice

- **Admin model list UX** (deferred 2026-11-01): the "Model gratis" table scrolls inside a fixed-height box, so admins think the list is cut off. Show the model count, drop the inner scroll, add a search box and a "reload list" button that bypasses the 1-hour catalog cache.
- **More models beyond OpenRouter's free list** (deferred 2026-11-01): OpenRouter currently has ~15 free text models. Options discussed:
  1. *Other providers with their own free tier* (Google AI Studio, Groq, Cerebras, …): admin adds a provider (name, base URL, encrypted API key, model slugs) in the UI. Most are OpenAI-compatible, so the existing gateway can be reused. Needs a providers table, a migration and per-model routing; the app cannot verify "free" for these, so the admin owns that. Preferred option.
  2. *Paid OpenRouter models*: same key, requires credits; replace the free-only guard with an admin allowlist plus a spend cap (and a credit limit on the key).
- **Fallback models**: send OpenRouter's `models` array so a busy free model falls back to another free one instead of failing with `upstream_unavailable`.
- **Custom display names** for models (e.g. "Gemma (cepat)").

## Platform

- **Per-user in-flight lock is in-process** (`apps/server/src/chat/chat.service.ts`): correct only with a single server process; multi-instance needs a DB or Redis lock.
- **`reasoning_details` are not replayed** to OpenRouter in history; reasoning models lose prior reasoning across turns.
- **`bun audit`: 1 moderate esbuild advisory**, dev-only via drizzle-kit; resolve when drizzle-kit updates.
