import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse";
import { Readable } from "node:stream";
import { db } from "@workspace/db";
import { routesTable } from "@workspace/db";
import type { InsertRoute } from "@workspace/db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/api/routes/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const csvContent = req.file.buffer.toString("utf-8");

  const records: InsertRoute[] = [];

  await new Promise<void>((resolve, reject) => {
    const stream = Readable.from(csvContent);
    stream
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        })
      )
      .on("data", (row: Record<string, string>) => {
        const origin = (row["origin"] || row["Origin"] || row["ORIGIN"] || "").toUpperCase().trim();
        const destination = (row["destination"] || row["Destination"] || row["DESTINATION"] || "").toUpperCase().trim();

        if (!origin || !destination) return;

        records.push({
          origin,
          destination,
          airline: row["airline"] || row["Airline"] || row["AIRLINE"] || null,
          flightNumber: row["flight_number"] || row["flightNumber"] || row["FlightNumber"] || row["FLIGHT_NUMBER"] || null,
          distance: row["distance"] ? parseInt(row["distance"], 10) || null : null,
          duration: row["duration"] || row["Duration"] || null,
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  if (records.length === 0) {
    res.status(400).json({ error: "No valid routes found in CSV. Expected columns: origin, destination (plus optional: airline, flight_number, distance, duration)" });
    return;
  }

  const chunkSize = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    await db.insert(routesTable).values(chunk);
    inserted += chunk.length;
  }

  res.json({ message: `Successfully imported ${inserted} routes.`, count: inserted });
});

router.get("/api/routes", async (_req, res) => {
  const routes = await db.select().from(routesTable).limit(100);
  res.json({ routes, total: routes.length });
});

router.delete("/api/routes", async (_req, res) => {
  await db.delete(routesTable);
  res.json({ message: "All routes deleted." });
});

export default router;
