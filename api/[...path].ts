// @ts-nocheck
export const config = { api: { bodyParser: false } };
import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { Pool } from "pg";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = new Pool({ connectionString, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });

let schemaReady: Promise<void> | undefined;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY, origin TEXT NOT NULL, origin_city TEXT, origin_flag TEXT,
        destination TEXT NOT NULL, destination_city TEXT, destination_flag TEXT,
        airline TEXT, airline_emoji TEXT, flight_number TEXT, aircraft TEXT, duration TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    })();
  }
  return schemaReady;
}

function csvValue(row: Record<string, string>, ...names: string[]) {
  for (const name of names) {
    const value = row[name]?.trim();
    if (value) return value;
  }
  return null;
}

app.use(express.json());

app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));

app.get("/api/routes", async (_req, res) => {
  try {
    await ensureSchema();
    const result = await pool.query(`SELECT id, origin, origin_city AS "originCity", origin_flag AS "originFlag", destination, destination_city AS "destinationCity", destination_flag AS "destinationFlag", airline, airline_emoji AS "airlineEmoji", flight_number AS "flightNumber", aircraft, duration, created_at AS "createdAt" FROM routes ORDER BY id DESC`);
    res.json({ routes: result.rows, total: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: "Could not load routes. Add DATABASE_URL in Vercel settings." });
  }
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a CSV file first." });
    await ensureSchema();
    const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    const values = rows.map((row) => ({
      origin: csvValue(row, "origin", "Origin", "ORIGIN")?.toUpperCase(),
      originCity: csvValue(row, "origin_city", "originCity", "Origin City"),
      originFlag: csvValue(row, "origin_flag", "originFlag", "Origin Flag"),
      destination: csvValue(row, "destination", "Destination", "DESTINATION")?.toUpperCase(),
      destinationCity: csvValue(row, "destination_city", "destinationCity", "Destination City"),
      destinationFlag: csvValue(row, "destination_flag", "destinationFlag", "Destination Flag"),
      airline: csvValue(row, "airline", "Airline"), airlineEmoji: csvValue(row, "airline_emoji", "airlineEmoji", "Airline Emoji"),
      flightNumber: csvValue(row, "flight_number", "flightNumber", "Flight Number"), aircraft: csvValue(row, "aircraft", "Aircraft"), duration: csvValue(row, "duration", "Duration"),
    })).filter((route) => route.origin && route.destination);
    if (!values.length) return res.status(400).json({ error: "CSV needs origin and destination columns." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const route of values) {
        await client.query(`INSERT INTO routes (origin, origin_city, origin_flag, destination, destination_city, destination_flag, airline, airline_emoji, flight_number, aircraft, duration) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [route.origin, route.originCity, route.originFlag, route.destination, route.destinationCity, route.destinationFlag, route.airline, route.airlineEmoji, route.flightNumber, route.aircraft, route.duration]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    res.json({ message: `Successfully imported ${values.length} routes.`, count: values.length });
  } catch (error) {
    res.status(500).json({ error: "Could not import the CSV. Check DATABASE_URL and try again." });
  }
});

app.delete("/api/routes", async (_req, res) => {
  try { await ensureSchema(); await pool.query("DELETE FROM routes"); res.json({ message: "All routes deleted." }); }
  catch { res.status(500).json({ error: "Could not delete routes." }); }
});

app.patch("/api/routes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const columns: Record<string, string> = { origin: "origin", originCity: "origin_city", originFlag: "origin_flag", destination: "destination", destinationCity: "destination_city", destinationFlag: "destination_flag", airline: "airline", airlineEmoji: "airline_emoji", flightNumber: "flight_number", aircraft: "aircraft", duration: "duration" };
  const updates = Object.entries(columns).filter(([key]) => key in req.body);
  if (!Number.isInteger(id) || !updates.length) return res.status(400).json({ error: "Invalid route update." });
  try {
    await ensureSchema();
    const result = await pool.query(`UPDATE routes SET ${updates.map(([, column], index) => `${column} = $${index + 1}`).join(", ")} WHERE id = $${updates.length + 1} RETURNING id, origin, origin_city AS "originCity", origin_flag AS "originFlag", destination, destination_city AS "destinationCity", destination_flag AS "destinationFlag", airline, airline_emoji AS "airlineEmoji", flight_number AS "flightNumber", aircraft, duration, created_at AS "createdAt"`, [...updates.map(([key]) => req.body[key] === "" ? null : req.body[key]), id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Route not found." });
    res.json({ route: result.rows[0] });
  } catch { res.status(500).json({ error: "Could not update route." }); }
});

app.get("/api/airports", async (_req, res) => {
  try { await ensureSchema(); const result = await pool.query("SELECT value FROM settings WHERE key = 'featured_airports'"); const airports = result.rows[0] ? JSON.parse(result.rows[0].value) : []; res.json({ airports: Array.isArray(airports) ? airports : [] }); }
  catch { res.status(500).json({ error: "Could not load airports." }); }
});

app.post("/api/airports", async (req, res) => {
  const codes = String(req.body?.codes ?? req.body?.code ?? "").split(/[\s,]+/).map((code) => code.trim().toUpperCase()).filter(Boolean);
  if (!codes.length) return res.status(400).json({ error: "At least one airport code is required." });
  try { await ensureSchema(); const result = await pool.query("SELECT value FROM settings WHERE key = 'featured_airports'"); const airports = result.rows[0] ? JSON.parse(result.rows[0].value) : []; const current = Array.isArray(airports) ? airports : []; const added = codes.filter((code) => !current.includes(code)); const existing = codes.filter((code) => current.includes(code)); const next = [...new Set([...current, ...added])].sort(); await pool.query("INSERT INTO settings (key, value) VALUES ('featured_airports', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(next)]); res.json({ added, existing, airports: next }); }
  catch { res.status(500).json({ error: "Could not save airports." }); }
});

app.delete("/api/airports/:code", async (req, res) => {
  const code = req.params.code?.trim().toUpperCase();
  try { await ensureSchema(); const result = await pool.query("SELECT value FROM settings WHERE key = 'featured_airports'"); const current = result.rows[0] ? JSON.parse(result.rows[0].value) : []; if (!Array.isArray(current) || !current.includes(code)) return res.status(404).json({ error: "Airport not found." }); const airports = current.filter((airport: string) => airport !== code); await pool.query("INSERT INTO settings (key, value) VALUES ('featured_airports', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(airports)]); res.json({ removed: code, airports }); }
  catch { res.status(500).json({ error: "Could not remove airport." }); }
});

function flagToEmoji(value: string) {
  const match = value.match(/^flag_([a-z]{2})$/i);
  if (!match) return value;
  return [...match[1].toUpperCase()].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join("");
}

async function sendDiscordMessage(message: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured in Vercel.");
  await ensureSchema();
  const stored = await pool.query("SELECT value FROM settings WHERE key = 'schedule_channel_id'");
  const channelId = process.env.DISCORD_CHANNEL_ID || stored.rows[0]?.value;
  if (!channelId) throw new Error("No Discord schedule channel is configured.");
  const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
  let content = message.replace(/\bflag_[a-z]{2}\b/gi, flagToEmoji);
  try {
    const channel = await fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers });
    const guildId = channel.ok ? (await channel.json()).guild_id : undefined;
    if (guildId) {
      const emojisResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/emojis`, { headers });
      if (emojisResponse.ok) {
        const emojis = await emojisResponse.json();
        const byName = new Map(emojis.map((emoji: any) => [emoji.name, emoji]));
        content = content.replace(/:([A-Za-z0-9_]+):/g, (raw, name) => {
          const emoji = byName.get(name);
          return emoji ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>` : raw;
        });
      }
    }
  } catch { /* Sending still works even if the emoji lookup is unavailable. */ }
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST", headers, body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discord rejected the message (${response.status}): ${detail}`);
  }
}

app.post("/api/send-message", async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) return res.status(400).json({ error: "message is required" });
  try {
    await sendDiscordMessage(message);
    res.json({ message: "Message sent" });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Could not send the Discord message." });
  }
});

app.get("/api/schedule", async (_req, res) => {
  try {
    await ensureSchema();
    const stored = await pool.query("SELECT value FROM settings WHERE key = 'airport_schedule'");
    const schedule = stored.rows[0] ? JSON.parse(stored.rows[0].value) : {};
    res.json({ schedule: schedule && typeof schedule === "object" ? schedule : {} });
  } catch { res.status(500).json({ error: "Could not load the airport schedule." }); }
});

app.post("/api/schedule", async (req, res) => {
  const date = String(req.body?.date ?? "");
  const codes = String(req.body?.codes ?? "").split(/[\s,]+/).map((code) => code.trim().toUpperCase()).filter(Boolean);
  const routeCount = Math.min(20, Math.max(1, Number(req.body?.routeCount) || 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !codes.length) return res.status(400).json({ error: "Choose a date and at least one airport." });
  try {
    await ensureSchema();
    const stored = await pool.query("SELECT value FROM settings WHERE key = 'airport_schedule'");
    const schedule = stored.rows[0] ? JSON.parse(stored.rows[0].value) : {};
    const next = schedule && typeof schedule === "object" ? schedule : {};
    next[date] = { airports: [...new Set(codes)].sort(), routeCount };
    await pool.query("INSERT INTO settings (key, value) VALUES ('airport_schedule', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(next)]);
    res.json({ date, airports: next[date].airports, routeCount, schedule: next });
  } catch { res.status(500).json({ error: "Could not save the airport schedule." }); }
});

app.post("/api/remove-schedule", async (req, res) => {
  const date = String(req.query.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Choose a valid date." });
  try {
    await ensureSchema();
    const stored = await pool.query("SELECT value FROM settings WHERE key = 'airport_schedule'");
    const schedule = stored.rows[0] ? JSON.parse(stored.rows[0].value) : {};
    const next = schedule && typeof schedule === "object" ? schedule : {};
    if (!Object.prototype.hasOwnProperty.call(next, date)) return res.status(404).json({ error: "Saved day not found." });
    delete next[date];
    await pool.query("INSERT INTO settings (key, value) VALUES ('airport_schedule', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(next)]);
    res.json({ removed: date, schedule: next });
  } catch { res.status(500).json({ error: "Could not remove the saved day." }); }
});

app.post("/api/post-routes", async (req, res) => {
  try {
    await ensureSchema();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const defaultDate = tomorrow.toISOString().slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date ?? "")) ? req.body.date : defaultDate;
    const featured = await pool.query("SELECT value FROM settings WHERE key = 'featured_airports'");
    const scheduled = await pool.query("SELECT value FROM settings WHERE key = 'airport_schedule'");
    const schedule = scheduled.rows[0] ? JSON.parse(scheduled.rows[0].value) : {};
    const scheduledDay = schedule?.[date];
    const airports = Array.isArray(scheduledDay) ? scheduledDay : (Array.isArray(scheduledDay?.airports) ? scheduledDay.airports : (featured.rows[0] ? JSON.parse(featured.rows[0].value) : []));
    const requestedCount = Number(req.body?.routeCount);
    const routeCount = Math.min(20, Math.max(1, Number.isFinite(requestedCount) ? requestedCount : (Number(scheduledDay?.routeCount) || 4)));
    if (!Array.isArray(airports) || !airports.length) return res.status(400).json({ error: `No airports are scheduled for ${date}.` });
    // Build one shared pool for every selected airport, then choose up to four
    // distinct routes. The old loop chose only one route per airport, so a
    // two-airport plan could never post more than two routes.
    const candidates: any[] = [];
    for (const airport of airports) {
      const result = await pool.query("SELECT origin, origin_city AS \"originCity\", origin_flag AS \"originFlag\", destination, destination_city AS \"destinationCity\", destination_flag AS \"destinationFlag\", airline_emoji AS \"airlineEmoji\", flight_number AS \"flightNumber\", aircraft, duration FROM routes WHERE UPPER(origin) = $1 OR UPPER(destination) = $1 ORDER BY RANDOM() LIMIT 20", [String(airport).toUpperCase()]);
      candidates.push(...result.rows);
    }
    const picked: any[] = [], used = new Set<string>();
    for (const route of candidates) {
      if (picked.length >= routeCount) break;
      const key = [route.origin, route.destination].sort().join("-");
      if (used.has(key)) continue;
      used.add(key);
      picked.push(route);
    }
    if (!picked.length) return res.status(400).json({ error: "No routes found for the scheduled airports." });
    const minutes = (duration: unknown) => { const match = String(duration ?? "").match(/^(\d+):(\d{2})$/); return match ? Number(match[1]) * 60 + Number(match[2]) : Infinity; };
    picked.sort((a, b) => minutes(a.duration) - minutes(b.duration));
    const day = String(req.body?.day ?? "").trim() || ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(date + "T00:00:00Z").getUTCDay()];
    const lines = picked.map((route: any) => { const origin = `${route.originCity || ""}${route.originFlag ? " " + route.originFlag : ""}(${route.origin})`; const destination = `${route.destinationCity || ""}${route.destinationFlag ? " " + route.destinationFlag : ""}(${route.destination})`; return [route.airlineEmoji ? `:${route.airlineEmoji}:` : "", route.flightNumber || "", `${origin} —> ${destination}`, route.aircraft || "", route.duration || ""].filter(Boolean).join(" | "); });
    await sendDiscordMessage(`${req.body?.includePilotPing !== false ? "<@&1208309349064376320>\n" : ""}**${day}**\n\n${lines.join("\n\n")}\n\n📌 NOTAMs are pinned to the channel`);
    if (req.body?.manual !== true) { delete schedule[date]; await pool.query("INSERT INTO settings (key, value) VALUES ('airport_schedule', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(schedule)]); await pool.query("INSERT INTO settings (key, value) VALUES ('featured_airports', '[]') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"); }
    res.json({ message: `Posted ${picked.length} routes for ${day}`, count: picked.length, day, date });
  } catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : "Could not post routes to Discord." }); }
});


app.post("/api/remove-airport", async (req, res) => {
  const code = String(req.query.code ?? "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Airport code is required." });
  try { await ensureSchema(); const result = await pool.query("SELECT value FROM settings WHERE key = 'featured_airports'"); const current = result.rows[0] ? JSON.parse(result.rows[0].value) : []; if (!Array.isArray(current) || !current.includes(code)) return res.status(404).json({ error: "Airport not found." }); const airports = current.filter((airport: string) => airport !== code); await pool.query("INSERT INTO settings (key, value) VALUES ('featured_airports', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(airports)]); res.json({ removed: code, airports }); }
  catch { res.status(500).json({ error: "Could not remove airport." }); }
});

export default app;
