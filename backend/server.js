/**
 * server.js — LocalDesk backend
 *
 * Routes:
 *   GET  /health                  → Docker healthcheck
 *   POST /api/session             → Provision a Napster WebRTC session token
 *   POST /tools/capture-lead      → Napster explicit tool webhook
 *   POST /tools/check-slots       → Napster explicit tool webhook
 *   POST /tools/book-appointment  → Napster explicit tool webhook
 *   GET  /api/leads               → Internal lead dashboard (JSON)
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { readFileSync, existsSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3001;
const NAPSTER_API_KEY = process.env.NAPSTER_API_KEY;
const TOOL_SECRET = process.env.INTERNAL_API_SECRET || "change_me";
const BASE = "https://companion-api.napster.com/public";

// ── Middleware ──────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://delightful-wave-0853e2c0f.7.azurestaticapps.net",
  // Add your custom domain here if you set one up
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, tool webhooks)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Allow any localhost port for local dev
    if (origin.startsWith("http://localhost:")) return callback(null, true);
    // Allow any azurestaticapps.net subdomain
    if (origin.endsWith(".azurestaticapps.net")) return callback(null, true);
    // Allow any ngrok URL for local tunneling
    if (origin.endsWith(".ngrok-free.app") || origin.endsWith(".ngrok.io")) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  allowedHeaders: ["Content-Type", "ngrok-skip-browser-warning", "x-internal-secret"],
}));
app.use(express.json());

// ── Load agent config (written by setup.js) ─────────────────────────────────
function loadAgentConfig() {
  const paths = [
    "/app/data/.agent-config.json", // Docker volume (written by entrypoint)
    ".agent-config.json",           // local dev
    "/app/.agent-config.json",      // legacy
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf-8"));
    }
  }
  return null;
}

// ── Napster API helper ───────────────────────────────────────────────────────
async function napsterPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": NAPSTER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Napster API error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// ── Auth middleware for tool webhooks ────────────────────────────────────────
function requireToolSecret(req, res, next) {
  const secret = req.headers["x-internal-secret"];
  if (secret !== TOOL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── SMS helper (optional Twilio) ─────────────────────────────────────────────
async function sendSms(body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, BUSINESS_OWNER_PHONE } =
    process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !BUSINESS_OWNER_PHONE) {
    console.log("[SMS] Twilio not configured, skipping. Message:", body);
    return;
  }
  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body,
      from: TWILIO_FROM_NUMBER,
      to: BUSINESS_OWNER_PHONE,
    });
    console.log("[SMS] Sent to owner.");
  } catch (err) {
    console.error("[SMS] Failed:", err.message);
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Status — lets frontend know if agent is configured and ready
app.get("/api/status", (req, res) => {
  const config = loadAgentConfig();
  res.json({
    ready: !!config,
    agentId: config?.agentId || null,
    backendUrl: config?.backendUrl || null,
    toolsEnabled: !!(config?.backendUrl && !config.backendUrl.includes("localhost")),
    message: config
      ? "Agent configured and ready"
      : "Agent not configured — run setup.js first",
  });
});

/**
 * POST /api/session
 * Body: { visitorId, visitorName?, lastService? }
 */
app.post("/api/session", async (req, res) => {
  const config = loadAgentConfig();
  if (!config) {
    return res.status(500).json({ error: "Agent not configured. Run setup.js first." });
  }

  const { visitorId, visitorName, lastService } = req.body;
  if (!visitorId) return res.status(400).json({ error: "visitorId is required" });

  const externalClientProfile = {
    visitor_id: visitorId, // Always pass so agent includes it in tool calls
  };
  if (visitorName) externalClientProfile.name = visitorName;
  if (lastService) externalClientProfile.lastService = lastService;

  try {
    const sessionBody = {
      channelType: "webrtc",
      externalClientId: visitorId,
      tags: {
        source: "web",
        env: process.env.NODE_ENV || "production",
        business_type: "med_spa",
      },
    };

    if (Object.keys(externalClientProfile).length > 0) {
      sessionBody.externalClientProfile = externalClientProfile;
    }

    const session = await napsterPost(`/agents/${config.agentId}/connections`, sessionBody);

    res.json({
      token: session.token,
      connectionId: session.connection?.id || session.id,
    });
  } catch (err) {
    console.error("[/api/session]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /tools/capture-lead
 */
app.post("/tools/capture-lead", requireToolSecret, async (req, res) => {
  const { visitor_id, name, phone, email, service_interest } = req.body?.arguments || req.body;

  const db = await getDb();
  const lead = {
    id: uuidv4(),
    visitor_id: visitor_id || "unknown",
    name,
    phone,
    email: email || null,
    service: service_interest,
    slot: null,
    status: "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.data.leads.push(lead);
  await db.write();

  console.log(`[lead captured] ${name} | ${phone} | ${service_interest}`);
  sendSms(`🔔 New LocalDesk lead!\nName: ${name}\nPhone: ${phone}\nInterested in: ${service_interest}`);

  res.json({
    success: true,
    message: `Thanks ${name}! I've saved your details. Let me check what appointments we have available.`,
    lead_id: lead.id,
  });
});

/**
 * POST /tools/check-slots
 */
app.post("/tools/check-slots", requireToolSecret, async (req, res) => {
  const { service } = req.body?.arguments || req.body;

  const db = await getDb();
  const available = db.data.slots.filter((s) => !s.taken).slice(0, 5);

  if (available.length === 0) {
    return res.json({
      available: false,
      message: "We're fully booked right now — let me take your info and we'll call you to schedule.",
    });
  }

  const slotList = available.map((s) => s.slot_time).join(", ");
  console.log(`[check-slots] service=${service} → ${slotList}`);

  res.json({
    available: true,
    service,
    slots: available.map((s) => s.slot_time),
    message: `Great news — here are the next available slots for ${service}: ${slotList}. Which works best for you?`,
  });
});

/**
 * POST /tools/book-appointment
 */
app.post("/tools/book-appointment", requireToolSecret, async (req, res) => {
  const { visitor_id, name, slot, service } = req.body?.arguments || req.body;

  const db = await getDb();

  // Mark slot taken
  const slotRecord = db.data.slots.find((s) => s.slot_time === slot && !s.taken);
  if (slotRecord) {
    slotRecord.taken = true;
  }

  // Update lead record
  const lead = db.data.leads
    .filter((l) => l.visitor_id === (visitor_id || "unknown") && l.status === "new")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  if (lead) {
    lead.slot = slot;
    lead.status = "booked";
    lead.updated_at = new Date().toISOString();
  }

  await db.write();

  const confirmationCode = `LD-${Date.now().toString(36).toUpperCase()}`;
  console.log(`[booked] ${name} | ${slot} | ${service} | ${confirmationCode}`);
  sendSms(`✅ Booking confirmed!\nName: ${name}\nService: ${service}\nSlot: ${slot}\nCode: ${confirmationCode}`);

  res.json({
    success: true,
    confirmation_code: confirmationCode,
    message: `You're all set, ${name}! Your ${service} appointment is confirmed for ${slot}. We'll send a reminder to your phone. We can't wait to see you!`,
  });
});

/**
 * GET /api/leads
 */
app.get("/api/leads", async (req, res) => {
  const db = await getDb();
  const leads = [...db.data.leads]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 100);
  res.json(leads);
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏢 LocalDesk backend running on port ${PORT}`);
  console.log(`   Health:  http://localhost:${PORT}/health`);
  console.log(`   Session: POST http://localhost:${PORT}/api/session`);
  console.log(`   Leads:   http://localhost:${PORT}/api/leads\n`);
});
