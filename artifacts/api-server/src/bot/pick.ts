import { db } from "@workspace/db";
import { routesTable } from "@workspace/db";
import type { Route } from "@workspace/db";
import { or, ilike } from "drizzle-orm";

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function durationToMinutes(d: string | null): number {
  if (!d) return Infinity;
  const match = d.match(/^(\d+):(\d{2})$/);
  if (!match) return Infinity;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export async function pickDistributedRoutes(airports: string[], total: number): Promise<Route[]> {
  const buckets: Route[][] = [];

  for (const code of airports) {
    const rows = await db
      .select()
      .from(routesTable)
      .where(or(ilike(routesTable.origin, code), ilike(routesTable.destination, code)));
    if (rows.length > 0) buckets.push(shuffle(rows));
  }

  if (buckets.length === 0) return [];

  const result: Route[] = [];
  let i = 0;
  while (result.length < total) {
    const activeBuckets = buckets.filter((b) => b.length > 0);
    if (activeBuckets.length === 0) break;
    const bucket = activeBuckets[i % activeBuckets.length];
    result.push(bucket.shift()!);
    i++;
  }

  return result.sort((a, b) => durationToMinutes(a.duration) - durationToMinutes(b.duration));
}
