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
| **Technical execution (25%)** | Full-stack: React + Node/Express + lowdb. Auto-provisions agent on first boot. Deployed on Azure Container Apps + Azure Static Web Apps. |
| **Creativity (25%)** | Solves a real daily problem for tens of thousands of local businesses. The "video receptionist that remembers you" is novel for the vertical. |
| **Presentation (20%)** | Demo flow: cold visit → booking confirmed → return visit with memory → leads dashboard |

---

## Live Deployment (Azure)

| Service | URL |
|---|---|
| **Frontend** | https://delightful-wave-0853e2c0f.7.azurestaticapps.net |
| **Backend** | https://localdesk-backend.calmsea-5724aa91.eastus.azurecontainerapps.io |
| **Health** | https://localdesk-backend.calmsea-5724aa91.eastus.azurecontainerapps.io/health |
| **Status** | https://localdesk-backend.calmsea-5724aa91.eastus.azurecontainerapps.io/api/status |
| **Leads** | https://localdesk-backend.calmsea-5724aa91.eastus.azurecontainerapps.io/api/leads |

---

## Architecture

```
Azure Static Web App (React + Napster Web SDK)
        │  WebRTC (video/audio)
        ▼
  Napster Omniagent API
        │  Explicit tool webhooks (HTTPS POST)
        ▼
  Azure Container App (Node/Express backend)
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

## Napster API Features Used

- **WebRTC video avatar** — embedded via `@touchcastllc/napster-companion-api` Web SDK
- **Persistent memory** — `externalClientId` per browser; agent remembers name + last service on return visits
- **`externalClientProfile`** — passes visitor name + last service to personalize greetings
- **Explicit tool calls** — 3 tools with full invocation prompts (preamble + confirmation patterns per docs)
- **Session tagging** — every session tagged with `source`, `business_type`, `env`

---

## Running Locally

See [JUDGES.md](./JUDGES.md) for full local setup instructions. The short version:

```bash
git clone https://github.com/villanub/localdesk-agent.git
cd localdesk-agent
cp .env.example .env   # add your NAPSTER_API_KEY
docker compose up --build
```

The backend auto-provisions the Napster agent on first boot. No manual setup steps required.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NAPSTER_API_KEY` | ✅ | Napster Omniagent API key |
| `INTERNAL_API_SECRET` | ✅ | Authenticates Napster → backend webhooks |
| `BACKEND_PUBLIC_URL` | ✅ | Public backend URL for tool webhooks (set automatically in Azure deployment) |
| `TWILIO_*` | Optional | SMS notifications to business owner on new lead/booking |

---

Built by Benjamin Villanueva · Austin, TX · Napster Omniagent Hackathon 2026
