# Skyview — Trueyy Web UI

React/Vite web app where interviewers and candidates sign in, manage
interview sessions, and drive a live monitored interview. That's its entire
job. Skyview speaks HTTP + Socket.IO to **Cortex** (the backend) and HTTP to
the local **Trueyy Helper** daemon (installed via **Jarvis**).

> For the end-to-end architecture — socket events, session lifecycle, how
> Skyview / Helper / Cortex talk during a session — see `Cortex/ARCHITECTURE.md`.

---

## Run Skyview locally

### Prerequisites

- Node.js 20+
- A running Cortex instance (defaults to `http://localhost:4000`)
- (Optional, required for monitoring flows) Trueyy Helper installed via Jarvis

### Setup

```bash
cd "Anti Cheating/Skyview"
cp .env.example .env.local
npm install
npm run dev          # Vite on http://localhost:5001
```

Open `http://localhost:5001` → sign up → create an interview.

### Build

```bash
npm run build        # output: dist/
npm run preview      # serve the built bundle locally
```

### Env vars (`.env.local`)

| Var | Default | Purpose |
|-----|---------|---------|
| `VITE_AUTH_API_URL` | `http://localhost:4000` | Cortex base URL. Used for REST, Socket.IO, and passed verbatim to the Helper on every `/session/join`. |
| `VITE_APP_NAME` / `VITE_APP_VERSION` | Skyview / 1.0.0 | Cosmetic. |
| `VITE_ENABLE_DEBUG` | `false` | Enables verbose logging. |

Switch Cortex environments by changing `VITE_AUTH_API_URL` and restarting
the dev server (or rebuilding). No Helper rebuild needed — the Helper
receives the Cortex URL fresh on every session bind.

---

## What Skyview provides

| Surface | Route | Role | Notes |
|---|---|---|---|
| Login / Signup | `/login`, `/signup` | Any | Email/password + company metadata |
| Dashboard | `/` | Any | Upcoming + past interview cards |
| Create interview | `/interviews/new` | Staff | Schedules a session in Cortex |
| Candidate join page | `/interviews/:id/join` | Candidate | 3-step setup (Helper → permissions → open meeting) |
| Monitoring view | `/interviews/:id/monitor` | Staff | Transcription + Analysis toggles + Pulse / Analysis / Screenshots / Transcript tabs |

---

## How Skyview connects to everything else

### → Cortex (REST + Socket.IO)

All routed through `VITE_AUTH_API_URL`:

- **REST** (`src/services/api.service.ts`) — auth, interview CRUD,
  session lifecycle (`/activate`, `/heartbeat`, `/deactivate`),
  image-analysis triggers.
- **Socket.IO** (`src/hooks/useRiskSocket.ts`) — auth header
  `{ token, client: "skyview" }`; receives `live-transcript`,
  `risk-pulse`, `window-result`, `image-analysis-result`,
  `modality-state`, `remote-capture-screenshots`, `remote-end-session`;
  emits `start-transcription`, `stop-transcription`,
  `start-analysis`, `stop-analysis`, `capture-screenshots`.
- **Deepgram proxy** — MicCapture (inside the Helper) opens
  `ws://<VITE_AUTH_API_URL>/deepgram` directly for live transcription.

### → Trueyy Helper (HTTP on localhost)

Helper is the local daemon installed by Jarvis. Skyview reaches it at
`127.0.0.1:48123` via `src/services/helperBridge.ts`:

- `GET /health` — is the Helper installed?
- `GET /status` — current session binding + permission flags
- `POST /session/join` — **the key call** — carries
  `{ session_id, participant_id, role, token, cortex_url }` so the
  Helper knows what to monitor and where to post results
- `POST /session/leave` — clean unbind
- `POST /session/token` — refresh the JWT mid-session
- `POST /open-settings` — opens the System Settings privacy pane

If the Helper isn't installed, `useHelper.installed === false` and Skyview
renders `HelperDownloadCard` with a link to the Jarvis installer.

---

## Project layout

```
Skyview/
├── README.md                   ← this file
├── .env.example
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx                 ← router
    ├── config/                 ← env, constants, user roles
    ├── contexts/               ← AuthContext, SnackbarContext
    ├── services/
    │   ├── api.service.ts      ← fetch wrapper + JWT refresh
    │   ├── auth.service.ts
    │   ├── interview.service.ts  ← activate / deactivate / heartbeat
    │   └── helperBridge.ts     ← calls to 127.0.0.1:48123
    ├── hooks/
    │   ├── useRiskSocket.ts    ← Socket.IO client + state for all live events
    │   └── useHelper.ts        ← polls Helper /status every 2s
    ├── components/
    │   ├── AppLayout/          ← dashboard, interview list/card, create page, candidate join
    │   ├── Monitoring/         ← MonitoringView, AnalyticsPanel, CandidateSetupCard
    │   └── common/             ← shared UI
    ├── types/
    └── utils/
```

---

## Day-to-day

- **Change UI code** → Vite hot-reloads; just save.
- **Change Cortex** → restart Cortex container; Skyview auto-reconnects its
  Socket.IO.
- **Change Helper (Sentinel source)** → rebuild Sentinel + re-run Jarvis
  `install.sh`; no Skyview change needed.
- **Test transcription** → toggle **Transcription** ON in MonitoringView;
  open the Transcript tab to see live bubbles.
