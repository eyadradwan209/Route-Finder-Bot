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

  function pairKey(r: Route): string {
    const a = r.origin.toUpperCase();
    const b = r.destination.toUpperCase();
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  const usedPairs = new Set<string>();
  const result: Route[] = [];
  let i = 0;
  while (result.length < total) {
    const activeBuckets = buckets.filter((b) => b.length > 0);
    if (activeBuckets.length === 0) break;
    const bucket = activeBuckets[i % activeBuckets.length];

    let picked: Route | undefined;
    while (bucket.length > 0) {
      const candidate = bucket.shift()!;
      const key = pairKey(candidate);
      if (!usedPairs.has(key)) {
        picked = candidate;
        usedPairs.add(key);
        break;
      }
    }

    i++;
    if (!picked) continue;
    result.push(picked);
  }

  return result.sort((a, b) => durationToMinutes(a.duration) - durationToMinutes(b.duration));
}
