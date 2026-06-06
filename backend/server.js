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
app.use(cors());
app.use(express.json());

// ── Load agent config (written by setup.js) ─────────────────────────────────
function loadAgentConfig() {
  const paths = [".agent-config.json", "/app/.agent-config.json"];
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
    console.log("[SMS] Twilio not configured, skipping. Message would be:", body);
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

/**
 * POST /api/session
 * Body: { visitorId, visitorName?, lastService? }
 *
 * Provisions a Napster WebRTC session and returns the token to the frontend.
 * The visitorId is the externalClientId — enables persistent memory.
 */
app.post("/api/session", async (req, res) => {
  const config = loadAgentConfig();
  if (!config) {
    return res.status(500).json({ error: "Agent not configured. Run setup.js first." });
  }

  const { visitorId, visitorName, lastService } = req.body;

  if (!visitorId) {
    return res.status(400).json({ error: "visitorId is required" });
  }

  // Build optional profile context
  const externalClientProfile = {};
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
 * Napster explicit tool webhook — saves lead to DB and sends SMS to owner.
 */
app.post("/tools/capture-lead", requireToolSecret, (req, res) => {
  const { visitor_id, name, phone, email, service_interest } = req.body?.arguments || req.body;
  const db = getDb();

  const id = uuidv4();
  db.prepare(`
    INSERT INTO leads (id, visitor_id, name, phone, email, service, status)
    VALUES (?, ?, ?, ?, ?, ?, 'new')
  `).run(id, visitor_id || "unknown", name, phone, email || null, service_interest);

  console.log(`[lead captured] ${name} | ${phone} | ${service_interest}`);

  // Fire-and-forget SMS
  sendSms(`🔔 New LocalDesk lead!\nName: ${name}\nPhone: ${phone}\nInterested in: ${service_interest}`);

  res.json({
    success: true,
    message: `Thanks ${name}! I've saved your details. Let me check what appointments we have available.`,
    lead_id: id,
  });
});

/**
 * POST /tools/check-slots
 * Returns up to 5 available slots for a given service.
 */
app.post("/tools/check-slots", requireToolSecret, (req, res) => {
  const { service } = req.body?.arguments || req.body;
  const db = getDb();

  const slots = db
    .prepare(`
      SELECT slot_time FROM available_slots
      WHERE taken = 0
      ORDER BY id
      LIMIT 5
    `)
    .all();

  if (slots.length === 0) {
    return res.json({
      available: false,
      message: "We're fully booked right now — let me take your info and we'll call you to schedule.",
    });
  }

  const slotList = slots.map((s) => s.slot_time).join(", ");
  console.log(`[check-slots] service=${service} → ${slotList}`);

  res.json({
    available: true,
    service,
    slots: slots.map((s) => s.slot_time),
    message: `Great news — here are the next available slots for ${service}: ${slotList}. Which works best for you?`,
  });
});

/**
 * POST /tools/book-appointment
 * Marks the slot as taken and updates the lead record.
 */
app.post("/tools/book-appointment", requireToolSecret, (req, res) => {
  const { visitor_id, name, slot, service } = req.body?.arguments || req.body;
  const db = getDb();

  // Mark slot taken
  db.prepare(`
    UPDATE available_slots SET taken = 1 WHERE slot_time = ? AND taken = 0
  `).run(slot);

  // Update lead record if it exists
  db.prepare(`
    UPDATE leads SET slot = ?, status = 'booked', updated_at = datetime('now')
    WHERE visitor_id = ? AND status = 'new'
    ORDER BY created_at DESC LIMIT 1
  `).run(slot, visitor_id || "unknown");

  console.log(`[booked] ${name} | ${slot} | ${service}`);

  // Fire-and-forget SMS
  sendSms(`✅ Booking confirmed!\nName: ${name}\nService: ${service}\nSlot: ${slot}`);

  res.json({
    success: true,
    confirmation_code: `LD-${Date.now().toString(36).toUpperCase()}`,
    message: `You're all set, ${name}! Your ${service} appointment is confirmed for ${slot}. We'll send a reminder to your phone. We can't wait to see you!`,
  });
});

/**
 * GET /api/leads
 * Returns all leads — for the internal dashboard and demo.
 */
app.get("/api/leads", (req, res) => {
  const db = getDb();
  const leads = db
    .prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 100")
    .all();
  res.json(leads);
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏢 LocalDesk backend running on port ${PORT}`);
  console.log(`   Health:     http://localhost:${PORT}/health`);
  console.log(`   Session:    POST http://localhost:${PORT}/api/session`);
  console.log(`   Leads:      http://localhost:${PORT}/api/leads\n`);
});
