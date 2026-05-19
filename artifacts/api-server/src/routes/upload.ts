import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse";
import { Readable } from "node:stream";
import { db } from "@workspace/db";
import { routesTable } from "@workspace/db";
import type { InsertRoute } from "@workspace/db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function col(row: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]?.trim();
    if (v) return v;
  }
  return null;
}

router.post("/routes/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const csvContent = req.file.buffer.toString("utf-8");
  const records: InsertRoute[] = [];

  await new Promise<void>((resolve, reject) => {
    Readable.from(csvContent)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row: Record<string, string>) => {
        const origin = col(row, "origin", "Origin", "ORIGIN")?.toUpperCase();
        const destination = col(row, "destination", "Destination", "DESTINATION")?.toUpperCase();
        if (!origin || !destination) return;

        records.push({
          origin,
          originCity: col(row, "origin_city", "originCity", "Origin City"),
          originFlag: col(row, "origin_flag", "originFlag", "Origin Flag"),
          destination,
          destinationCity: col(row, "destination_city", "destinationCity", "Destination City"),
          destinationFlag: col(row, "destination_flag", "destinationFlag", "Destination Flag"),
          airline: col(row, "airline", "Airline"),
          airlineEmoji: col(row, "airline_emoji", "airlineEmoji", "Airline Emoji"),
          flightNumber: col(row, "flight_number", "flightNumber", "Flight Number"),
          aircraft: col(row, "aircraft", "Aircraft"),
          duration: col(row, "duration", "Duration"),
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  if (records.length === 0) {
    res.status(400).json({
      error: "No valid routes found. CSV must have at minimum: origin, destination columns.",
    });
    return;
  }

  const chunkSize = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    await db.insert(routesTable).values(records.slice(i, i + chunkSize));
    inserted += records.slice(i, i + chunkSize).length;
  }

  res.json({ message: `Successfully imported ${inserted} routes.`, count: inserted });
});

router.get("/routes", async (_req, res) => {
  const routes = await db.select().from(routesTable).limit(100);
  res.json({ routes, total: routes.length });
});

router.delete("/routes", async (_req, res) => {
  await db.delete(routesTable);
  res.json({ message: "All routes deleted." });
});

export default router;
