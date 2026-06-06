import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join("/app/data", "localdesk.db");

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id          TEXT PRIMARY KEY,
      visitor_id  TEXT NOT NULL,
      name        TEXT,
      phone       TEXT,
      email       TEXT,
      service     TEXT,
      slot        TEXT,
      status      TEXT DEFAULT 'new',
      notes       TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS available_slots (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_time TEXT NOT NULL,
      service   TEXT,
      taken     INTEGER DEFAULT 0
    );
  `);

  // Seed slots if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM available_slots").get();
  if (count.c === 0) {
    const insert = db.prepare(
      "INSERT INTO available_slots (slot_time, service) VALUES (?, ?)"
    );
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const times = ["10:00 AM", "11:30 AM", "1:00 PM", "2:30 PM", "4:00 PM"];
    const services = ["HydraFacial", "Botox Consultation", "Laser Treatment", "Filler Consultation", "Chemical Peel"];
    for (const day of days) {
      for (let i = 0; i < times.length; i++) {
        insert.run(`${day} at ${times[i]}`, services[i % services.length]);
      }
    }
  }
}
