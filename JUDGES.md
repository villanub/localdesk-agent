# Judge Setup Guide — LocalDesk

**Live demo (no setup required):**
👉 https://delightful-wave-0853e2c0f.7.azurestaticapps.net

If the live demo is working, you don't need to run anything locally.

---

## Option A — Use the live deployment (recommended)

Everything is already deployed on Azure:

| Service | URL |
|---|---|
| **Frontend** | https://delightful-wave-0853e2c0f.7.azurestaticapps.net |
| **Backend** | https://localdesk-backend.calmsea-5724aa91.eastus.azurecontainerapps.io |
| **Health** | https://localdesk-backend.calmsea-5724aa91.eastus.azurecontainerapps.io/health |
| **Status** | https://localdesk-backend.calmsea-5724aa91.eastus.azurecontainerapps.io/api/status |
| **Leads** | https://localdesk-backend.calmsea-5724aa91.eastus.azurecontainerapps.io/api/leads |

---

## Option B — Run locally with Docker

### Prerequisites
- Docker Desktop
- A Napster Omniagent API key

### Steps

**1. Clone and configure**
```bash
git clone https://github.com/villanub/localdesk-agent.git
cd localdesk-agent
cp .env.example .env
```

Edit `.env` — minimum required:
```
NAPSTER_API_KEY=your_key_here
INTERNAL_API_SECRET=any_random_string
BACKEND_PUBLIC_URL=http://localhost:3001
```

**2. Start everything**
```bash
docker compose up --build
```

On first boot, the backend automatically:
- Creates the Maya companion in your Napster account
- Registers the 3 tool webhooks (capture lead, check slots, book appointment)
- Creates the Omniagent
- Saves config to a persistent Docker volume

Wait for this in the logs before opening the browser:
```
✅ Agent setup complete.
```

**3. Open the app**
- Frontend → http://localhost:5173
- Leads dashboard → http://localhost:3001/api/leads
- Status → http://localhost:3001/api/status

> Note: Tool webhooks (booking/lead capture) require Napster's servers to reach your
> backend. For local testing the video agent will connect and converse, but booking
> confirmation requires a publicly reachable backend URL. Use the live deployment
> (Option A) for the full booking flow.

---

## Demo script

**Cold visit (core agent flow)**
1. Open the frontend
2. Click "Talk to Maya"
3. Ask about a HydraFacial
4. Maya qualifies you, checks availability, and confirms a booking
5. Check `/api/leads` to see the captured lead record

**Return visit (persistent memory)**
1. Close and reopen the browser tab
2. Click "Talk to Maya" again
3. Maya greets you by name and references your last service — memory in action

---

## Napster API features demonstrated

| Feature | Where |
|---|---|
| WebRTC video avatar | Frontend — Maya appears as a live video agent |
| Persistent memory | Return visit — agent remembers name + last service across sessions |
| `externalClientProfile` | Session init — passes visitor context to personalize greetings |
| Explicit tool calls | Booking flow — 3 webhooks fire to Azure backend |
| Session tagging | Every session tagged with `source`, `business_type`, `env` |

---

## Architecture

```
Azure Static Web App (React frontend)
        │  HTTPS
        ▼
Azure Container App (Node/Express backend)
        │  Explicit tool webhooks (HTTPS POST)
        ▼
Napster Omniagent API
        │  WebRTC / WebSocket
        ▼
Browser (Napster Web SDK — live video avatar)
```

---

Built by Tercio Studios · Austin, TX · Napster Omniagent Hackathon 2026
