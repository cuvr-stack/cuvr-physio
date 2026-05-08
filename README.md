# CuVR Physio — VR Physiotherapy Platform

Meta Quest 3 WebXR physiotherapy gamification app with real-time physiotherapist dashboard.

## Architecture

| App | Port | Description |
|-----|------|-------------|
| `apps/vr-app` | 3000 | Meta Quest 3 WebXR experience (React Three Fiber) |
| `apps/api` | 3001/3002 | Fastify REST API + Socket.io telemetry server |
| `apps/dashboard` | 3002 | Physiotherapist real-time dashboard (Next.js) |

## Quick Start

```bash
# Install dependencies
npm install

# Run all apps in dev mode
npm run dev
```

## Stack

- **VR**: React Three Fiber + `@react-three/xr` (WebXR for Quest 3)
- **Backend**: Fastify + Socket.io
- **Dashboard**: Next.js + Tailwind + Recharts
- **Shared Types**: TypeScript package shared across all apps
- **Database**: Supabase (Postgres + Auth + Realtime)
- **State**: Zustand (VR app)

## Meta Quest 3 Setup

1. Enable Developer Mode on your Quest 3
2. Open the Meta Quest Browser and navigate to your local IP: `https://192.168.x.x:3000`
3. WebXR requires HTTPS — use `mkcert` locally or deploy to Vercel for testing

## Data Flow

```
Quest 3 (VR App)
  └─ Socket.io emit('telemetry:update', frame) @ 10fps
       └─ API Server (validates + broadcasts)
            └─ Socket.io to('patient:{id}') → Dashboard
                  └─ Live ROM chart updates
```
