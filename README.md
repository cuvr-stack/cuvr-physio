# CuVR Physio

VR-based physiotherapy platform built for Meta Quest 3, with a real-time
physiotherapist dashboard and an AI coach that watches each session live,
generates clinical SOAP notes, and tracks longitudinal patient outcomes.

---

## Stack at a glance

| App | Port | What it is |
|---|---|---|
| `apps/vr-app` | 3000 | Patient-facing WebXR app for the Quest. Eight game modes share one engine, all auto-tuned to the patient's age, height, and affected side. |
| `apps/api` | 3001 | Fastify + Socket.io. Hosts REST routes, telemetry broadcasting, the AI Coach loop, longitudinal insights, and SOAP-note generation. |
| `apps/dashboard` | 3002 | Physiotherapist console. Patient management, live session monitor, schedule, analytics, MFA, idle auto-logout. |
| `packages/shared-types` | n/a | TypeScript types shared by all three apps (`TelemetryFrame`, `CoachDecision`, `AIChallenge`, etc.) |

Everything is one **npm workspaces + Turbo** monorepo. A change to a shared
type plus its three consumers ships in a single commit.

---

## Architecture

```
┌─────────────────┐                 ┌─────────────────────────────┐
│  Quest 3 / WebXR│  Socket.io      │   Dashboard (Next.js)       │
│  apps/vr-app    │ ───telemetry──► │   apps/dashboard            │
│                 │ ◄──coach events │   live monitor + AI Coach   │
└────────┬────────┘                 └────────────┬────────────────┘
         │                                       │
         │  REST                          REST   │
         ▼                                       ▼
        ┌─────────────────────────────────────────────┐
        │          API (Fastify + Socket.io)          │
        │          apps/api                           │
        │                                             │
        │  ▸ AI Coach service (Claude every 5s)      │
        │  ▸ Patient insights (longitudinal)         │
        │  ▸ SOAP note generation (after each session)│
        │  ▸ Patient lifecycle / discharge workflow  │
        │  ▸ Stale session cleanup                   │
        └────────────────────┬────────────────────────┘
                             │
                             ▼
                ┌──────────────────────────┐
                │   Supabase (Postgres)    │
                │   RLS · Auth · pg_cron   │
                └──────────────────────────┘
```

The AI Coach is the live differentiator: every 5 seconds during a session it
summarises the last buffer of telemetry frames, asks Claude for a difficulty
adjustment + motivational message, and broadcasts the decision to the VR app
(which adapts target geometry) and the dashboard (which displays the
decision in the Coach feed). After session end, it auto-drafts a SOAP note
and refreshes the patient's longitudinal trend insight.

---

## Prerequisites

- **Node.js 20.x** (the Supabase JS client needs a Node 20+ realtime polyfill that's already wired in)
- **npm 10+** (ships with Node 20)
- **Supabase project** (free tier is fine)
- **Anthropic API key** (optional — without it, every AI feature falls back to a deterministic rule engine and still works)

---

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/cuvr-stack/cuvr-physio.git
cd cuvr-physio
nvm use 20         # or otherwise ensure Node 20 is active
npm install        # installs all three workspaces

# 2. Configure environment
cp .env.example apps/api/.env
cp .env.example apps/dashboard/.env.local
cp .env.example apps/vr-app/.env.local
# Then fill in real values — see "Environment variables" below

# 3. Apply database migrations (once, in Supabase SQL Editor)
# See apps/api/supabase/migrations/ — paste each .sql file in order

# 4. Run all three apps
npm run dev        # turbo brings up vr-app:3000, api:3001, dashboard:3002
```

Open:
- **`http://localhost:3000`** — VR app (use Quest browser via ngrok for real WebXR; desktop browser works for development without immersive mode)
- **`http://localhost:3002`** — physio dashboard
- **`http://localhost:3001/health`** — API health check

---

## Environment variables

Every variable has a sensible default for local development; the AI features
gracefully degrade when keys are missing. Required values are marked.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Project URL from Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Anon key (safe to expose) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | ✓ for API | Service role key — **never** expose to clients |
| `NEXT_PUBLIC_API_URL` | ✓ | Where the dashboard + VR app reach the API (`http://localhost:3001` for dev) |
| `NEXT_PUBLIC_SOCKET_URL` | ✓ | Socket.io endpoint (same as `NEXT_PUBLIC_API_URL`) |
| `ANTHROPIC_API_KEY` |  | Without it, AI Coach / Insights / SOAP fall back to rule engines |
| `AI_COACH_MODEL` |  | Claude model id, defaults to `claude-haiku-4-5` |
| `AI_COACH_TICK_MS` |  | Coach decision frequency; defaults to `5000` |
| `NEXT_PUBLIC_IDLE_TIMEOUT_MS` |  | Dashboard idle auto-logout in ms; defaults to `900000` (15 min) |
| `NEXT_PUBLIC_IDLE_WARNING_MS` |  | Warning popup countdown in ms; defaults to `30000` (30 s) |

⚠️ **Secrets never get committed.** `.env`, `.env.local`, and `.env.*.local`
are in `.gitignore`. `.env.example` is the template you fork.

---

## Database migrations

All migrations live in `apps/api/supabase/migrations/`. Apply each in order
to a fresh Supabase project via the SQL Editor. They're additive and idempotent
(`create … if not exists`, `add column if not exists`).

| # | File | Adds |
|---|---|---|
| 001 | `001_initial.sql` | `profiles`, `patients`, `sessions`, `session_results` + RLS |
| 002 | `002_gamification.sql` | `achievements`, `player_stats`, `player_achievements` |
| 003 | `003_appointments.sql` | `appointments` table for the schedule |
| 004 | `004_ai_coach_events.sql` | Audit log of every AI coach decision |
| 005 | `005_ai_session_challenges.sql` | Per-session AI-generated challenges |
| 006 | `006_session_cleanup_cron.sql` | `pg_cron` sweep — optional safety net for stuck sessions |
| 007 | `007_patient_lifecycle.sql` | Discharge workflow (`status`, `discharged_at`, `discharged_reason`) |
| 008 | `008_patient_demographics.sql` | `height_cm`, `affected_side` for game-tuning |
| 009 | `009_patient_insights.sql` | Longitudinal AI insight rows |
| 010 | `010_soap_notes.sql` | Auto-drafted SOAP notes with edit + sign-off audit trail |
| 011 | `011_session_pain_vas.sql` | Pre/post-session pain scores (0–10 VAS) |

If you ever hit `column X does not exist` on the dashboard, you've missed a
migration somewhere in this list.

---

## Game modes (apps/vr-app)

Eight modes, one engine. All share the scoring / AI / SOAP pipelines and
auto-tune to demographics.

| Mode | Body region | Mechanic | Hardware |
|---|---|---|---|
| Reach Cascade | Shoulder | Sequential reach to vertical targets | Hands |
| Cosmic Catch | Shoulder + reaction | Falling targets, intercept before they hit ground | Hands |
| Boxing Drills | Rotator cuff + bilateral | Hand-locked left/right targets | Hands |
| Zen Archer | Scapular stability | Bow-draw gesture with form-quality biofeedback | Hands |
| Galactic Shield | Multi-planar reach | Velocity-driven threats from all angles + per-hand shields | Hands |
| Knee Flexion | Knee | Heel-pull progression (controller strapped to ankle) | Controller-on-leg |
| Hip Abduction | Hip | Lateral leg-lift arc (controller on ankle) | Controller-on-leg |
| Cervical Stargazer | Neck | Gaze-locked star targets with hold-time | Headset only |

---

## Day-to-day commands

```bash
# Run only one workspace
npm run dev --workspace=@physio-vr/api
npm run dev --workspace=@physio-vr/dashboard
npm run dev --workspace=@physio-vr/vr-app

# Type-check the whole monorepo
npm run type-check

# Build production bundles
npm run build
```

---

## Deploying to a Meta Quest

WebXR needs HTTPS. Two paths:

**Option A — `ngrok` (recommended for dev)**
```bash
ngrok http 3000          # tunnels the VR app
ngrok http 3001          # tunnels the API
# Update apps/vr-app/.env.local with the https://...ngrok URLs
```

**Option B — chrome://flags on Quest**
On the Quest browser → `chrome://flags` → search *"Insecure origins treated
as secure"* → add `http://YOUR_LAN_IP:3000` → Relaunch.

For production, deploy `apps/dashboard` and `apps/vr-app` to Vercel and the
API to Railway/Render/Fly. Supabase is already hosted.

---

## Project structure

```
physio-vr/
├── apps/
│   ├── api/                    Fastify + Socket.io + AI services
│   │   ├── src/
│   │   │   ├── routes/         REST routes (patients, sessions, soap, …)
│   │   │   ├── services/       aiCoach, patientInsights, soapNotes
│   │   │   ├── socket/         telemetry handler
│   │   │   └── lib/            supabase client, scoring, achievements
│   │   └── supabase/migrations/    All 11 SQL migrations
│   ├── dashboard/              Next.js 14 — physio-facing
│   │   └── src/
│   │       ├── app/            Routes (/patients, /sessions, /schedule, /analytics, /login, …)
│   │       ├── components/     Reusable: Sidebar, MFA, IdleTimeout, SoapNotes, …
│   │       └── lib/            Supabase server + browser clients
│   └── vr-app/                 Next.js + react-three-fiber + WebXR
│       └── src/
│           ├── components/     VRScene, GameOrchestrator, per-mode scenes (ZenArcher, Stargazer, etc.)
│           ├── store/          Zustand stores (game, session)
│           └── hooks/          useMetrics, etc.
└── packages/
    └── shared-types/           TelemetryFrame, CoachDecision, AIChallenge
```

---

## License

Proprietary — © CUVR Spatial Systems. All rights reserved.
