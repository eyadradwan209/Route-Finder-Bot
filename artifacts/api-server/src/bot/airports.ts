import { eq } from "drizzle-orm";
import { db, FEATURED_AIRPORTS_KEY, settingsTable } from "@workspace/db";

async function saveAirports(airports: string[]) {
  await db
    .insert(settingsTable)
    .values({
      key: FEATURED_AIRPORTS_KEY,
      value: JSON.stringify(airports),
    })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: JSON.stringify(airports) },
    });
}

export async function addAirport(code: string): Promise<boolean> {
  const upper = code.toUpperCase().trim();
  const airports = await listAirports();
  if (airports.includes(upper)) return false;
  airports.push(upper);
  airports.sort();
  await saveAirports(airports);
  return true;
}

export async function removeAirport(code: string): Promise<boolean> {
  const upper = code.toUpperCase().trim();
  const airports = await listAirports();
  const next = airports.filter((airport) => airport !== upper);
  if (next.length === airports.length) return false;
  await saveAirports(next);
  return true;
}

export async function listAirports(): Promise<string[]> {
  const rows = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, FEATURED_AIRPORTS_KEY));

  if (!rows[0]) return [];

  try {
    const parsed = JSON.parse(rows[0].value);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").sort()
      : [];
  } catch {
    return [];
  }
}

export async function hasAirport(code: string): Promise<boolean> {
  const airports = await listAirports();
  return airports.includes(code.toUpperCase().trim());
}
