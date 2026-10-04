// @ts-nocheck
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

app.post("/api/routes/upload", upload.single("file"), async (req, res) => {
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

export default app;
