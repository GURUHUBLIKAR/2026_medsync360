# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MedSync 360 — a React + TypeScript + Vite SPA for hospital **referral management**. Doctors create patient referrals, send them across departments, accept/decline/transfer/close them, with a full **medication audit trail** and **transfer chain**, plus Excel report export. Backend is **Supabase** (Postgres + Auth + Storage + RPC functions). Supporting modules: Dashboard, Research Insight (OpenAI), private Chat/Messages, Duty Roster, Video.

The referral system is the core; everything else supports the clinical workflow around it. The authoritative deep-dives are [docs/MEDSYNC_PROJECT_DOCUMENTATION.md](docs/MEDSYNC_PROJECT_DOCUMENTATION.md) and [docs/REFERRAL_AND_MEDICATION_JOURNEY.md](docs/REFERRAL_AND_MEDICATION_JOURNEY.md) — consult them before changing referral/medication logic.

## Commands

```bash
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # Production build (tsc is NOT part of build; run it separately)
npm run preview    # Preview the production build
npm run lint       # ESLint
npm run seed       # Seed research data (needs SUPABASE_SERVICE_ROLE_KEY)
npx tsc --noEmit   # Typecheck — the reliable correctness gate (see below)
```

- **There is no test framework** — no `test` script, no test runner, no test files. Do not assume Jest/Vitest exists. The practical pre-commit checks are `npx tsc --noEmit` (must be clean) and `npm run build` (must succeed).
- **`npm run lint` is currently very noisy** (hundreds of `@typescript-eslint/no-explicit-any` errors in pre-existing code). A clean lint run is not the bar; don't try to fix unrelated lint debt when making a change. Keep *new* code clean.
- Environment is **Windows / PowerShell**. A `Bash` tool is also available for POSIX scripts.

## Environment & secrets

Requires a `.env` (gitignored) with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ENCRYPTION_KEY`, `VITE_OPENAI_API_KEY`, `VITE_APP_ENV`, `VITE_APP_VERSION`. Scripts also use `SUPABASE_SERVICE_ROLE_KEY`.

- **`.env.example` currently contains real, live credentials** (not placeholders), including a real OpenAI key. Treat these as compromised; do not propagate them. Never commit real keys.
- The **OpenAI key is consumed client-side** (`VITE_OPENAI_API_KEY` in [src/lib/openai.ts](src/lib/openai.ts)) — any `VITE_*` var ships in the browser bundle, so the key is publicly exposed. Moving this behind a server/Edge Function is a known production task.
- `.mcp.json` (gitignored) holds a Supabase MCP server config with a personal access token.

## Architecture

**State split:** `Zustand` ([src/store/authStore.ts](src/store/authStore.ts)) owns auth/session/profile only. **All server data goes through TanStack React Query** hooks in `src/hooks/` — never fetch Supabase directly inside components for list/CRUD data; add or reuse a hook. The `QueryClient` is configured in [src/App.tsx](src/App.tsx) (5-min staleTime; some hooks override to `staleTime: 0` for freshness, e.g. medication trail).

**Auth gate flow** (in `App.tsx`): unauthenticated → `/login`; authenticated but `profile.profile_completed_at` is null → `/onboarding`; otherwise → app routes. `authStore.initialize()` is called once on mount and hydrates `user` + `profile`. Routes are `React.lazy`-loaded and wrapped in `<ProtectedRoute>` + `<Layout>`.

**`users.id === auth.uid()`** — the app `users` table row id equals the Supabase auth user id. RLS policies and inserts rely on this (e.g. `from_user_id = auth.uid()`). Use `profile.id` as the user identity everywhere.

### Referral system — the parts that bite

These conventions cause silent failures if violated:

1. **Perspective-based status mapping.** The DB status and the UI label differ depending on whether you're the sender or receiver. The DB has `Acknowledged`; the UI shows `Accepted`. Mapping lives in `mapStatusForDisplay` / `mapStatusForDatabase` ([src/types/referral.types.ts](src/types/referral.types.ts)) and is applied in `fetchReferrals` ([src/hooks/useReferrals.ts](src/hooks/useReferrals.ts)). When filtering by tab/status, know which space (DB vs UI) you're in.

2. **RPC parameter names must exactly match the Postgres function signatures.** Mismatched names don't error — they silently pass `null`. Key RPCs: `transfer_referral`, `complete_referral`, `get_complete_medication_trail`, `get_medication_timeline`, `get_referral_transfer_history` (params are prefixed `p_`, e.g. `p_referral_id`). The full contract is in MEDSYNC_PROJECT_DOCUMENTATION.md §12.

3. **Atomic multi-table operations are done in Postgres RPCs, not the client.** A transfer creates a child referral, flips the original to `Transferred`, and writes medication history — all inside `transfer_referral()`. **It does NOT copy attachment rows** — attachments stay on whichever referral they were uploaded to; use `get_chain_attachments()` to surface all files across the chain. Don't reimplement these as sequential client calls.

4. **Medication trail spans the whole transfer chain.** Referrals link via `transfer_parent_id`. `get_complete_medication_trail()` aggregates every medication action across the chain; the Excel report and the ReferralDetails timeline both consume it. Field is `record_timestamp` (not `timestamp`).

5. **Excel export auto-fires on close** (patient-attended path) via [src/utils/excelExport.ts](src/utils/excelExport.ts). It is both statically and dynamically imported — expect the Vite "dynamically imported but also statically imported" build warning; it's benign.

### Other cross-cutting pieces

- **Client-side encryption** for sensitive HIPAA fields via `crypto-js` + `VITE_ENCRYPTION_KEY` ([src/lib/encryption.ts](src/lib/encryption.ts)).
- **Duty notifications** (in-app bell): `duty_notifications` table + [src/hooks/useNotifications.ts](src/hooks/useNotifications.ts) (polls every 20s) + the bell in [src/components/layout/Header.tsx](src/components/layout/Header.tsx). Notification creation on duty swap is **best-effort** (wrapped in try/catch in [src/hooks/useDuties.ts](src/hooks/useDuties.ts)) — it must never block the swap, and the query fails soft if the table is absent.
- **Global error logging** to the `app_logs` table via [src/lib/logger.ts](src/lib/logger.ts), wired in `App.tsx`.
- The single Supabase client is [src/lib/supabase.ts](src/lib/supabase.ts) — import `supabase` from there, don't construct new clients.

## Database & migrations

- SQL lives in `supabase/migrations/`. **Migrations are applied manually and in filename order**, not via an automated pipeline. There are several near-duplicate files for the same change (e.g. multiple `*_add_decline_reasons*` and `*_final_v2` variants) — when adding a migration, check what's actually applied in the live DB rather than trusting the file set, and don't blindly re-run old variants.
- A **Supabase MCP server is configured** (`.mcp.json`, project ref `tnytqbpbkxdvdfiefmvy`). When available, prefer it to inspect the live schema/RLS (`list_tables`, `execute_sql`), apply migrations (`apply_migration`), and run `get_advisors` after DDL. Always check the live schema before assuming a column/table/policy exists — the generated `src/types/database.types.ts` is incomplete (e.g. the `users` table isn't fully represented there).
- **All tables have RLS enabled.** Note `duty_roster` currently has a permissive `"Users can update shifts"` policy (`USING true`) that lets any authenticated user update any duty — this is what makes cross-doctor duty swaps work, but it's broader than ideal.

## Working in this repo

- The working tree is often messy (many untracked components, migrations, and deleted docs). Run `git status` before assuming a file's tracked state. The default branch for PRs is `main`; active work happens on dated feature branches.
- Match the surrounding code style: feature-first folders under `src/components/features/<feature>/`, hooks in `src/hooks/`, types in `src/types/`, framer-motion for animation, Tailwind for styling, `cn()` from [src/lib/utils.ts](src/lib/utils.ts) for class merging.
