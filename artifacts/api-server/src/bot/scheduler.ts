import { Client, TextChannel, ChannelType } from "discord.js";
import { eq } from "drizzle-orm";
import { db, settingsTable, SCHEDULE_CHANNEL_KEY } from "@workspace/db";
import { logger } from "../lib/logger";
import { listAirports } from "./airports";
import { formatRoute } from "./format";
import { pickDistributedRoutes } from "./pick";

let scheduleChannelId: string | null = null;
let scheduledTimeout: ReturnType<typeof setTimeout> | null = null;

export async function loadScheduleChannel() {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, SCHEDULE_CHANNEL_KEY));

  scheduleChannelId = rows[0]?.value ?? null;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Returns the number of milliseconds until the next 19:00 UTC.
 *
 * For example:
 * - At 18:00 UTC, it schedules today at 19:00 UTC.
 * - At 20:00 UTC, it schedules tomorrow at 19:00 UTC.
 */
function msUntilNext1900UTC(): number {
  const now = new Date();

  let nextPost = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      19,
      0,
      0,
      0
    )
  );

  // If today's 19:00 UTC has already passed, schedule tomorrow.
  if (nextPost.getTime() <= now.getTime()) {
    nextPost = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        19,
        0,
        0,
        0
      )
    );
  }

  return nextPost.getTime() - now.getTime();
}

export async function postDailyRoutes(client: Client, dayOverride?: string) {
  if (!scheduleChannelId) return;

  const airports = await listAirports();

  if (airports.length === 0) {
    logger.info(
      "Daily schedule fired but no featured airports configured"
    );
    return;
  }

  let channel: TextChannel;

  try {
    const ch = await client.channels.fetch(scheduleChannelId);

    if (!ch || ch.type !== ChannelType.GuildText) {
      logger.warn(
        { channelId: scheduleChannelId },
        "Scheduled channel not found or not a text channel"
      );
      return;
    }

    channel = ch as TextChannel;
  } catch (err) {
    logger.error(
      { err, channelId: scheduleChannelId },
      "Failed to fetch schedule channel"
    );
    return;
  }

  const now = new Date();

  // The routes are posted at 19:00 UTC for the following UTC day.
  const nextDay = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    )
  );

  const dayName =
    dayOverride?.trim() || DAYS[nextDay.getUTCDay()];

  const picked = await pickDistributedRoutes(airports, 4);

  if (picked.length === 0) {
    logger.info(
      { airports },
      "No routes found for any featured airport"
    );
    return;
  }

  const lines = picked.map((route) => formatRoute(route, client));

  const note = "\n\n📌 NOTAMs are pinned to the channel";

  const message =
    `<@&1208309349064376320>\n` +
    `**${dayName}**\n\n` +
    `${lines.join("\n\n")}` +
    `${note}`;

  try {
    await channel.send(message);

    logger.info(
      {
        airports,
        dayName,
        count: picked.length,
        scheduledFor: "19:00Z",
      },
      "Posted next day's daily routes"
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to send daily routes message"
    );
  }
}

export function startScheduler(client: Client) {
  function scheduleNext() {
    const ms = msUntilNext1900UTC();

    logger.info(
      {
        msUntil1900UTC: ms,
        nextPostTime: new Date(Date.now() + ms).toISOString(),
      },
      "Next daily route post scheduled"
    );

    scheduledTimeout = setTimeout(async () => {
      try {
        await postDailyRoutes(client);
      } catch (err) {
        logger.error(
          { err },
          "Unexpected error while posting scheduled routes"
        );
      } finally {
        scheduleNext();
      }
    }, ms);
  }

  // Prevent multiple scheduler timers from running.
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout);
    scheduledTimeout = null;
  }

  scheduleNext();
}

export async function setScheduleChannel(channelId: string) {
  scheduleChannelId = channelId;

  await db
    .insert(settingsTable)
    .values({
      key: SCHEDULE_CHANNEL_KEY,
      value: channelId,
    })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: channelId },
    });
}

export function getScheduleChannel(): string | null {
  return scheduleChannelId;
}

export async function clearScheduleChannel() {
  scheduleChannelId = null;

  await db
    .delete(settingsTable)
    .where(eq(settingsTable.key, SCHEDULE_CHANNEL_KEY));
}