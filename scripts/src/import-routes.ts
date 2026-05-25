import fs from "fs";
import pg from "pg";

const { Client } = pg;

const csvPath = process.argv[2];

if (!csvPath) {
  console.error("Usage: pnpm --filter @workspace/scripts run import-routes -- path/to/routes.csv");
  process.exit(1);
}

function parseCSVLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("TRUNCATE TABLE routes RESTART IDENTITY");
  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCSVLine(lines[0]);

  let count = 0;

  for (const line of lines.slice(1)) {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, i) => {
      row[header] = values[i] || "";
    });

    await client.query(
      `INSERT INTO routes 
      (origin, destination, origin_city, origin_flag, destination_city, destination_flag, airline, airline_emoji, flight_number, aircraft, duration)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        row.origin,
        row.destination,
        row.origin_city,
        row.origin_flag,
        row.destination_city,
        row.destination_flag,
        row.airline,
        row.airline_emoji,
        row.flight_number,
        row.aircraft,
        row.duration,
      ]
    );

    count++;
  }

  await client.end();
  console.log(`Imported ${count} routes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
