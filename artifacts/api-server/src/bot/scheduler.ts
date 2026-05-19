import { Client, TextChannel, ChannelType } from "discord.js";
import { db } from "@workspace/db";
import { routesTable } from "@workspace/db";
import type { Route } from "@workspace/db";
import { or, ilike } from "drizzle-orm";
import { logger } from "../lib/logger";
import { listAirports } from "./airports";
import { formatRoute } from "./format";

let scheduleChannelId: string | null = null;
let scheduledTimeout: ReturnType<typeof setTimeout> | null = null;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function msUntilNextMidnightUTC(): number {
  const now = new Date();
  const nextMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return nextMidnight.getTime() - now.getTime();
}

export async function postDailyRoutes(client: Client) {
  if (!scheduleChannelId) return;

  const airports = listAirports();
  if (airports.length === 0) {
    logger.info("Daily schedule fired but no featured airports configured");
    return;
  }

  let channel: TextChannel;
  try {
    const ch = await client.channels.fetch(scheduleChannelId);
    if (!ch || ch.type !== ChannelType.GuildText) {
      logger.warn({ channelId: scheduleChannelId }, "Scheduled channel not found or not a text channel");
      return;
    }
    channel = ch as TextChannel;
  } catch (err) {
    logger.error({ err, channelId: scheduleChannelId }, "Failed to fetch schedule channel");
    return;
  }

  const now = new Date();
  const dayName = DAYS[now.getUTCDay()];

  for (const airport of airports) {
    const matching = await db
      .select()
      .from(routesTable)
      .where(or(ilike(routesTable.origin, airport), ilike(routesTable.destination, airport)));

    if (matching.length === 0) {
      logger.info({ airport }, "No routes found for featured airport, skipping");
      continue;
    }

    const picked: Route[] = pickRandom(matching, Math.min(4, matching.length));
    const lines = picked.map((r) => formatRoute(r, client));

    const note = `\n\n📌 NOTAMs are pinned to the channel`;
    const message = `<@&1208309349064376320>\n**${dayName}**\n\n${lines.join("\n\n")}${note}`;

    try {
      await channel.send(message);
      logger.info({ airport, dayName, count: picked.length }, "Posted daily routes");
    } catch (err) {
      logger.error({ err, airport }, "Failed to send daily routes message");
    }
  }
}

export function startScheduler(client: Client) {
  function scheduleNext() {
    const ms = msUntilNextMidnightUTC();
    logger.info({ msUntilMidnightUTC: ms }, "Next daily route post scheduled");
    scheduledTimeout = setTimeout(async () => {
      await postDailyRoutes(client);
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}

export function setScheduleChannel(channelId: string) {
  scheduleChannelId = channelId;
}

export function getScheduleChannel(): string | null {
  return scheduleChannelId;
}

export function clearScheduleChannel() {
  scheduleChannelId = null;
}
