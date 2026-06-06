/**
 * db.js — lightweight JSON file database using lowdb (zero native deps).
 * Data is persisted to /app/data/localdesk.json inside Docker,
 * or ./data/localdesk.json locally.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use /app/data inside Docker (volume mount), fallback to local ./data
const DATA_DIR = existsSync("/app/data") ? "/app/data" : join(__dirname, "data");
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, "localdesk.json");

// Default schema
const defaultData = {
  leads: [],
  slots: [],
};

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  const adapter = new JSONFile(DB_PATH);
  const db = new Low(adapter, defaultData);
  await db.read();

  // Seed slots if empty
  if (db.data.slots.length === 0) {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const times = ["10:00 AM", "11:30 AM", "1:00 PM", "2:30 PM", "4:00 PM"];
    const services = [
      "HydraFacial",
      "Botox Consultation",
      "Laser Treatment",
      "Filler Consultation",
      "Chemical Peel",
    ];
    let id = 1;
    for (const day of days) {
      for (let i = 0; i < times.length; i++) {
        db.data.slots.push({
          id: id++,
          slot_time: `${day} at ${times[i]}`,
          service: services[i % services.length],
          taken: false,
        });
      }
    }
    await db.write();
  }

  dbInstance = db;
  return db;
}
