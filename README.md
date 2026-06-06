# LocalDesk — AI Receptionist for Local Service Businesses
### Napster Omniagent API Hackathon Submission · May 18 – June 15, 2026

---

## What It Is

**LocalDesk** is a video AI receptionist that handles inbound leads for local service businesses — med spas, salons, clinics — 24/7. It uses the Napster Omniagent API to deliver a lifelike video avatar that greets visitors, qualifies them (service interest, timing, budget), captures their contact info, books them into an available slot, and notifies the business owner via SMS — all in a single real-time voice + video conversation.

Every return visitor is **remembered by name** across sessions. The agent picks up where it left off.

---

## Why This Scores High on the Rubric

| Criterion | How LocalDesk delivers |
|---|---|
| **Use of API (30%)** | Uses WebRTC video avatar, persistent cross-session memory (`externalClientId`), explicit tool calling (lead capture, availability check, booking confirmation), `externalClientProfile` for personalization — features only possible with the Omniagent API |
| **Technical execution (25%)** | Full-stack: React frontend + Node/Express backend + SQLite lead DB + optional Twilio SMS, all in a single `docker compose up` |
| **Creativity (25%)** | Solves a real, daily problem for tens of thousands of local businesses. The "video receptionist that remembers you" is a novel experience for the vertical |
| **Presentation (20%)** | Demo video walks through a cold visit → warm return visit → business owner SMS notification |

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
        ├── POST /api/session        → provisions Napster session token
        ├── POST /tools/capture-lead → saves lead to SQLite, sends SMS
        ├── POST /tools/check-slots  → returns available appointment times
        ├── POST /tools/book-appt    → confirms booking, updates DB
        ├── GET  /api/leads          → internal dashboard
        └── GET  /health             → Docker healthcheck
```

---

## Napster API Features Used

- **WebRTC video avatar** — embedded via `@touchcastllc/napster-companion-api` Web SDK
- **Persistent memory** — `externalClientId` per browser session; agent remembers name, service interest, last visit
- **`externalClientProfile`** — passes visitor name + last service to personalize the greeting on return visits
- **Explicit tool calls** — three tools with proper invocation prompts (preamble + confirmation patterns per docs)
- **Session tagging** — every session tagged with `source: web`, `business_id`, `env` for analytics

---

## Quick Start

### Prerequisites
- Docker Desktop
- A Napster Omniagent API key ([get one here](https://www.napster.com/developer))

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd localdesk
cp .env.example .env
# Edit .env — add your NAPSTER_API_KEY and INTERNAL_API_SECRET
```

### 2. Bootstrap the agent (first run only)

```bash
cd backend
npm install
node setup.js
```

This creates the companion, registers the three tools, and creates the agent in your Napster account. It writes the resulting IDs to `.agent-config.json`.

### 3. Start everything

```bash
cd ..
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Lead dashboard: http://localhost:3001/api/leads

---

## Project Structure

```
localdesk/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── setup.js          ← one-time agent bootstrap
│   ├── server.js         ← Express API + tool webhooks
│   └── db.js             ← SQLite lead store
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── components/
        │   ├── AgentWidget.jsx   ← Napster Web SDK wrapper
        │   ├── HeroSection.jsx
        │   └── LeadConfirm.jsx
        └── index.css
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NAPSTER_API_KEY` | ✅ | Your Napster Omniagent API key |
| `INTERNAL_API_SECRET` | ✅ | Secret to authenticate Napster → backend tool webhooks |
| `PORT` | optional | Backend port (default: 3001) |
| `TWILIO_ACCOUNT_SID` | optional | Twilio SID for SMS notifications |
| `TWILIO_AUTH_TOKEN` | optional | Twilio auth token |
| `TWILIO_FROM_NUMBER` | optional | Your Twilio phone number |
| `BUSINESS_OWNER_PHONE` | optional | Owner's phone to receive lead SMS |

SMS is gracefully skipped if Twilio credentials are absent.

---

## Demo Script (for video)

1. **Cold visit** — open the site, click "Talk to our receptionist", video avatar appears, ask about a HydraFacial
2. **Lead capture** — agent collects name + phone, checks slots, confirms booking, owner receives SMS
3. **Return visit** — clear session storage, re-open site with same visitor ID injected, agent greets you by name and references your last booking — memory in action

---

Built by Tercio Studios · Austin, TX
