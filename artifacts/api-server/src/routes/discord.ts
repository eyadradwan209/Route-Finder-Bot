import { Router } from "express";
import { ChannelType, TextChannel } from "discord.js";
import { getClient } from "../bot";
import { getScheduleChannel } from "../bot/scheduler";
import { listAirports } from "../bot/airports";
import { pickDistributedRoutes } from "../bot/pick";
import { formatRoute } from "../bot/format";

const router = Router();

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function fetchScheduleChannel() {
  const client = getClient();
  if (!client) throw new Error("Bot is not connected");

  const channelId = getScheduleChannel();
  if (!channelId) throw new Error("No schedule channel configured");

  const ch = await client.channels.fetch(channelId);
  if (!ch || ch.type !== ChannelType.GuildText) {
    throw new Error("Schedule channel not found or not a text channel");
  }
  return ch as TextChannel;
}

router.post("/discord/post-routes", async (req, res) => {
  const client = getClient();
  if (!client) {
    res.status(503).json({ error: "Bot is not connected to Discord" });
    return;
  }

  let channel: TextChannel;
  try {
    channel = await fetchScheduleChannel();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(503).json({ error: msg });
    return;
  }

  const airports = await listAirports();
  if (airports.length === 0) {
    res.status(400).json({ error: "No featured airports configured. Add airports via /addairport first." });
    return;
  }

  const now = new Date();
  const { day, includePilotPing = true } = req.body as {
    day?: string;
    includePilotPing?: boolean;
  };
  const dayName: string = day?.trim() || DAYS[now.getUTCDay()]!;

  const picked = await pickDistributedRoutes(airports, 4);
  if (picked.length === 0) {
    res.status(400).json({ error: "No routes found for any featured airport" });
    return;
  }

  const lines = picked.map((r) => formatRoute(r, client));
  const note = `\n\n📌 NOTAMs are pinned to the channel`;
  const pilotPing = includePilotPing ? "<@&1208309349064376320>\n" : "";
  const message = `${pilotPing}**${dayName}**\n\n${lines.join("\n\n")}${note}`;

  await channel.send(message);
  res.json({ message: `Posted ${picked.length} routes for ${dayName}`, count: picked.length, day: dayName });
});

router.post("/discord/send-message", async (req, res) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  let channel: TextChannel;
  try {
    channel = await fetchScheduleChannel();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(503).json({ error: msg });
    return;
  }

  await channel.send(message.trim());
  res.json({ message: "Message sent" });
});

export default router;
