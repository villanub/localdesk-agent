# LocalDesk — AI Receptionist for Local Service Businesses
### Napster Omniagent API Hackathon Submission · May 18 – June 15, 2026

**🔴 Live demo:** https://delightful-wave-0853e2c0f.7.azurestaticapps.net

**📋 Judge setup guide:** [JUDGES.md](./JUDGES.md)

---

## What It Is

**LocalDesk** is a video AI receptionist that handles inbound leads for local service businesses — med spas, salons, clinics — 24/7. It uses the Napster Omniagent API to deliver a lifelike video avatar that greets visitors, qualifies them, captures their contact info, books them into an available slot, and notifies the business owner via SMS — all in a single real-time voice + video conversation.

Every return visitor is **remembered by name** across sessions via persistent memory.

---

## Why This Scores High on the Rubric

| Criterion | How LocalDesk delivers |
|---|---|
| **Use of API (30%)** | WebRTC video avatar, persistent cross-session memory (`externalClientId`), explicit tool calling (lead capture, availability check, booking confirmation), `externalClientProfile` for personalization |
| **Technical execution (25%)** | Full-stack: React + Node/Express + lowdb, all in a single `docker compose up`. Auto-provisions agent on first boot. |
| **Creativity (25%)** | Solves a real daily problem for tens of thousands of local businesses. The "video receptionist that remembers you" is novel for the vertical. |
| **Presentation (20%)** | Demo video: cold visit → warm return visit (memory) → booking confirmed → owner SMS |

---

## Architecture

```
Browser (React + Napster Web SDK)
        │  WebRTC (video/audio)
        ▼
  Napster Omniagent API
        │  Explicit tool webhooks (HTTPS POST)
        ▼
  LocalDesk Backend (Node/Express)
        │
        ├── GET  /health             → Docker healthcheck
        ├── GET  /api/status         → Frontend readiness check
        ├── POST /api/session        → Provisions Napster session token
        ├── POST /tools/capture-lead → Saves lead to DB, sends SMS
        ├── POST /tools/check-slots  → Returns available appointment times
        ├── POST /tools/book-appt    → Confirms booking, updates DB
        └── GET  /api/leads          → Internal lead dashboard
```

---

## Quick Start (Judges)

### Prerequisites
- Docker Desktop running
- A Napster Omniagent API key

### 1. Clone and configure

```bash
git clone https://github.com/villanub/localdesk-agent.git
cd localdesk-agent
cp .env.example .env
```

Edit `.env` — the only required field is:
```
NAPSTER_API_KEY=your_key_here
INTERNAL_API_SECRET=any_random_string
```

### 2. Start everything

```bash
docker compose up --build
```

**That's it.** On first boot, the backend automatically runs `setup.js` to create the companion, tools, and agent in your Napster account. The config is saved to a Docker volume so subsequent starts are instant.

- Frontend → http://localhost:5173
- Lead dashboard → http://localhost:3001/api/leads
- Status → http://localhost:3001/api/status

### 3. Enable tool webhooks (booking, lead capture)

For tools to fire, Napster needs a public URL to POST back to. Run ngrok in a separate terminal:

```bash
ngrok http 3001
```

Add the URL to `.env`:
```
BACKEND_PUBLIC_URL=https://xxxxx.ngrok-free.app
```

Then restart:
```bash
docker compose down -v   # -v clears the volume so setup re-runs with the new URL
docker compose up --build
```

---

## Napster API Features Used

- **WebRTC video avatar** — embedded via `@touchcastllc/napster-companion-api` Web SDK
- **Persistent memory** — `externalClientId` per browser; agent remembers name + last service on return visits
- **`externalClientProfile`** — passes visitor name + last service to personalize greetings
- **Explicit tool calls** — 3 tools with full invocation prompts (preamble + confirmation patterns)
- **Session tagging** — every session tagged with `source`, `business_type`, `env`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NAPSTER_API_KEY` | ✅ | Napster Omniagent API key |
| `INTERNAL_API_SECRET` | ✅ | Authenticates Napster → backend webhooks |
| `BACKEND_PUBLIC_URL` | For tools | Public URL (ngrok or deployed) for tool webhooks |
| `TWILIO_*` | Optional | SMS notifications to business owner |

---

Built by Benjamin Villanueva · Austin, TX
