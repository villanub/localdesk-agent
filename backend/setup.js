/**
 * setup.js — One-time bootstrap script.
 * Run: node setup.js
 *
 * Creates:
 *   1. A custom companion (the receptionist persona)
 *   2. Three explicit tools (capture_lead, check_slots, book_appointment)
 *   3. An Omniagent that ties them together
 *
 * Writes the resulting IDs to .agent-config.json so server.js can use them.
 * Safe to re-run — deletes existing tools by name before recreating.
 */

import "dotenv/config";
import { writeFileSync } from "fs";
import fetch from "node-fetch";

const BASE = "https://companion-api.napster.com/public";
const HEADERS = {
  "X-Api-Key": process.env.NAPSTER_API_KEY,
  "Content-Type": "application/json",
};

const BACKEND_URL = process.env.BACKEND_PUBLIC_URL || "http://localhost:3001";
const TOOL_SECRET = process.env.INTERNAL_API_SECRET || "change_me";
const TOOL_NAMES = ["capture_lead", "check_slots", "book_appointment"];

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === "DELETE" && res.status === 404) return null; // already gone
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("API error:", JSON.stringify(json, null, 2));
    throw new Error(`${method} ${path} → ${res.status}`);
  }
  return json;
}

async function deleteExistingTools() {
  console.log("Cleaning up existing tools...");
  for (const name of TOOL_NAMES) {
    try {
      await api("DELETE", `/functions/${name}`);
      console.log(`  ✓ Deleted tool: ${name}`);
    } catch {
      console.log(`  - Tool not found, skipping: ${name}`);
    }
  }
  console.log();
}

async function main() {
  console.log("🚀 LocalDesk — Napster Omniagent Setup\n");
  console.log(`   Backend URL: ${BACKEND_URL}\n`);

  // ── 0. Clean up old tools ────────────────────────────────────────────────
  await deleteExistingTools();

  // ── 1. Create companion ──────────────────────────────────────────────────
  console.log("Creating companion...");
  const companion = await api("POST", "/companions", {
    firstName: "Maya",
    lastName: "from LocalDesk",
    description:
      "Maya is a warm, professional receptionist for a modern med spa. She has a calm, welcoming presence and a light Texas drawl. She helps visitors learn about services, checks appointment availability, and books them in — quickly and without pressure. She remembers returning visitors by name and references their past conversations naturally, like a great front-desk person would. She never reads from a script; she listens first, then guides.",
  });
  console.log(`  ✓ Companion created: ${companion.id}\n`);

  // ── 2. Create tools ──────────────────────────────────────────────────────
  console.log("Creating tools...");

  const captureLeadTool = await api("POST", "/functions", {
    data: {
      name: "capture_lead",
      description:
        "Save the visitor's contact information and service interest to the CRM.",
      parameters: {
        type: "object",
        properties: {
          visitor_id: {
            type: "string",
            description: "The unique visitor ID for this session",
          },
          name: { type: "string", description: "Visitor's full name" },
          phone: {
            type: "string",
            description: "Visitor's phone number, digits and dashes only",
          },
          email: {
            type: "string",
            description: "Visitor's email address (optional)",
          },
          service_interest: {
            type: "string",
            description: "The service or treatment the visitor is most interested in",
          },
        },
        required: ["visitor_id", "name", "phone", "service_interest"],
      },
    },
    flow: "explicit",
    url: `${BACKEND_URL}/tools/capture-lead`,
    headers: { "x-internal-secret": TOOL_SECRET },
    receiveMessages: false,
    prompt:
      "Use this tool after you have collected the visitor's name, phone number, and service interest. " +
      "Before calling, confirm the details with the visitor: 'Just to confirm — I have your name as [name], phone as [phone], and you're interested in [service]. Is that right?' " +
      "Wait for explicit confirmation before calling. " +
      "Do NOT call if the visitor has not provided at least their name and phone number. " +
      "Do NOT call for general questions about services or pricing.",
  });
  console.log(`  ✓ capture_lead tool: ${captureLeadTool.id}`);

  const checkSlotsTool = await api("POST", "/functions", {
    data: {
      name: "check_slots",
      description:
        "Look up available appointment slots for a given service. Returns up to 5 upcoming openings.",
      parameters: {
        type: "object",
        properties: {
          service: {
            type: "string",
            description: "The service or treatment to check availability for",
          },
        },
        required: ["service"],
      },
    },
    flow: "explicit",
    url: `${BACKEND_URL}/tools/check-slots`,
    headers: { "x-internal-secret": TOOL_SECRET },
    receiveMessages: false,
    prompt:
      "Use this tool when the visitor asks about availability, scheduling, or wants to book an appointment. " +
      "Before calling, say something like 'Let me check what we have available for that.' " +
      "Do NOT call this tool for general questions about pricing or service descriptions. " +
      "Do NOT call before the visitor has expressed interest in a specific service.",
  });
  console.log(`  ✓ check_slots tool: ${checkSlotsTool.id}`);

  const bookApptTool = await api("POST", "/functions", {
    data: {
      name: "book_appointment",
      description:
        "Confirm and book an appointment slot for the visitor. Only call after capture_lead and check_slots have both been called successfully.",
      parameters: {
        type: "object",
        properties: {
          visitor_id: {
            type: "string",
            description: "The unique visitor ID for this session",
          },
          name: { type: "string", description: "Visitor's full name" },
          slot: {
            type: "string",
            description: "The exact slot string the visitor chose (e.g. 'Tuesday at 2:30 PM')",
          },
          service: {
            type: "string",
            description: "The service being booked",
          },
        },
        required: ["visitor_id", "name", "slot", "service"],
      },
    },
    flow: "explicit",
    url: `${BACKEND_URL}/tools/book-appointment`,
    headers: { "x-internal-secret": TOOL_SECRET },
    receiveMessages: false,
    prompt:
      "Use this tool only after check_slots has returned available times AND the visitor has selected a specific slot and given explicit confirmation. " +
      "Before calling, confirm: 'Perfect — I'll go ahead and book you in for [slot] for [service]. Shall I confirm that?' " +
      "Wait for a clear yes before calling. " +
      "Do NOT call without explicit visitor confirmation. " +
      "Do NOT call if capture_lead has not already been called in this session.",
  });
  console.log(`  ✓ book_appointment tool: ${bookApptTool.id}\n`);

  // ── 3. Create the Omniagent ───────────────────────────────────────────────
  console.log("Creating Omniagent...");
  const agent = await api("POST", "/agents", {
    companionId: companion.id,
    name: "LocalDesk Receptionist",
    voiceId: "alloy",
    functions: [captureLeadTool.id, checkSlotsTool.id, bookApptTool.id],
    providerSettings: {
      temperature: 0.7,
    },
  });
  console.log(`  ✓ Omniagent created: ${agent.id}\n`);

  // ── 4. Persist config ────────────────────────────────────────────────────
  const config = {
    companionId: companion.id,
    agentId: agent.id,
    tools: {
      captureLeadId: captureLeadTool.id,
      checkSlotsId: checkSlotsTool.id,
      bookApptId: bookApptTool.id,
    },
    backendUrl: BACKEND_URL,
    createdAt: new Date().toISOString(),
  };

  // Allow overriding output path via --config-path flag (used by Docker entrypoint)
  const configPathArg = process.argv.find((a, i) => process.argv[i - 1] === "--config-path");
  const configPath = configPathArg || ".agent-config.json";
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Config saved to ${configPath}`);
  console.log("\nNext: `docker compose up` to start LocalDesk\n");
  console.log(JSON.stringify(config, null, 2));
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
