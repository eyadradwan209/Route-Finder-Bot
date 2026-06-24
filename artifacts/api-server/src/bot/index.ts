import {
  Client,
  GatewayIntentBits,
  Interaction,
  ChatInputCommandInteraction,
  ChannelType,
  Events,
} from "discord.js";
import { db } from "@workspace/db";
import { routesTable } from "@workspace/db";
import type { Route } from "@workspace/db";
import { logger } from "../lib/logger";
import { registerCommands } from "./commands";
import { addAirport, removeAirport, listAirports } from "./airports";
import { formatRoute } from "./format";
import { pickDistributedRoutes } from "./pick";
import {
  startScheduler,
  postDailyRoutes,
  setScheduleChannel,
  getScheduleChannel,
  clearScheduleChannel,
} from "./scheduler";

async function handleRoutes(interaction: ChatInputCommandInteraction, client: Client) {
  const raw = interaction.options.getString("airport", true);
  const airports = raw
    .split(/[\s,]+/)
    .map((c) => c.toUpperCase().trim())
    .filter(Boolean);

  await interaction.deferReply();

  const picked: Route[] = await pickDistributedRoutes(airports, 5);

  if (picked.length === 0) {
    await interaction.editReply(
      `No routes found departing or arriving at **${airports.join(", ")}**. Make sure the airport codes are correct and routes have been imported.`
    );
    return;
  }

  const lines = picked.map((r) => formatRoute(r, client));
  const label = airports.length === 1 ? airports[0] : airports.join(", ");
  const day = interaction.options.getString("day");

  const note = day ? `\n\n📌 NOTAMs are pinned to the channel` : "";
  const header = day
    ? `**${day}**\n\n`
    : `✈️ **${picked.length} random routes for ${label}**:\n\n`;

  await interaction.editReply(`${header}${lines.join("\n\n")}${note}`);
}

async function handleAddAirport(interaction: ChatInputCommandInteraction) {
  const raw = interaction.options.getString("code", true);

  const codes = raw
    .split(",")
    .map((code) => code.toUpperCase().trim())
    .filter(Boolean);

  if (codes.length === 0) {
    await interaction.reply("Please provide at least one airport code.");
    return;
  }

  const added: string[] = [];
  const alreadyAdded: string[] = [];

  for (const code of codes) {
    if (addAirport(code)) {
      added.push(code);
    } else {
      alreadyAdded.push(code);
    }
  }

  const messages: string[] = [];

  if (added.length > 0) {
    messages.push(`✅ Added to featured airports: **${added.join(", ")}**`);
  }

  if (alreadyAdded.length > 0) {
    messages.push(`Already in featured airports: **${alreadyAdded.join(", ")}**`);
  }

  await interaction.reply(messages.join("\n"));
}

async function handleRemoveAirport(interaction: ChatInputCommandInteraction) {
  const code = interaction.options.getString("code", true).toUpperCase().trim();

  const removed = removeAirport(code);

  if (removed) {
    await interaction.reply(`🗑️ **${code}** removed from featured airports.`);
  } else {
    await interaction.reply(`**${code}** was not in the featured airports list.`);
  }
}

async function handleListAirports(interaction: ChatInputCommandInteraction) {
  const airports = listAirports();

  if (airports.length === 0) {
    await interaction.reply("No featured airports yet. Use `/addairport` to add some.");
    return;
  }

  await interaction.reply(
    `🛫 **Featured airports** (${airports.length}):\n${airports.join(", ")}`
  );
}

async function handleRouteCount(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const rows = await db.select({ id: routesTable.id }).from(routesTable);

  await interaction.editReply(
    `📊 There are **${rows.length}** routes in the database.`
  );
}

async function handleSetSchedule(
  interaction: ChatInputCommandInteraction,
  client: Client
) {
  const channel = interaction.options.getChannel("channel", true);

  if (channel.type !== ChannelType.GuildText) {
    await interaction.reply("Please select a text channel.");
    return;
  }

  setScheduleChannel(channel.id);

  await interaction.reply(
    `✅ Daily routes will be posted in <#${channel.id}> at **0000Z** every day for each featured airport.\nUse \`/testschedule\` to send a preview now.`
  );

  logger.info({ channelId: channel.id }, "Schedule channel set");
}

async function handleUnsetSchedule(interaction: ChatInputCommandInteraction) {
  const existing = getScheduleChannel();

  if (!existing) {
    await interaction.reply("No schedule is currently set.");
    return;
  }

  clearScheduleChannel();

  await interaction.reply("🛑 Daily route posts have been stopped.");
}

async function handleTestSchedule(
  interaction: ChatInputCommandInteraction,
  client: Client
) {
  const channelId = getScheduleChannel();

  if (!channelId) {
    await interaction.reply("No schedule channel set. Use `/setschedule` first.");
    return;
  }

  await interaction.reply(`Posting today's routes to <#${channelId}> now...`);

  await postDailyRoutes(client);
}

async function handleInteraction(interaction: Interaction, client: Client) {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "routes":
        await handleRoutes(interaction, client);
        break;

      case "addairport":
        await handleAddAirport(interaction);
        break;

      case "removeairport":
        await handleRemoveAirport(interaction);
        break;

      case "listairports":
        await handleListAirports(interaction);
        break;

      case "routecount":
        await handleRouteCount(interaction);
        break;

      case "setschedule":
        await handleSetSchedule(interaction, client);
        break;

      case "unsetschedule":
        await handleUnsetSchedule(interaction);
        break;

      case "testschedule":
        await handleTestSchedule(interaction, client);
        break;

      default:
        await interaction.reply("Unknown command.");
    }
  } catch (err) {
    logger.error(
      { err, command: interaction.commandName },
      "Error handling Discord command"
    );

    const msg = "An error occurred while processing that command.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
}

export async function startBot() {
  logger.info("startBot() was called");

  const token = process.env["DISCORD_BOT_TOKEN"];

  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is required");
  }

  logger.info("Discord token exists");

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once("ready", (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot is ready");
    startScheduler(client);
  });

  client.on("interactionCreate", (interaction) =>
    handleInteraction(interaction, client)
  );

  logger.info("Logging into Discord...");
  await client.login(token);
  logger.info("Discord login successful");

  registerCommands()
    .then(() => {
      logger.info("Discord slash commands registered");
    })
    .catch((err) => {
      logger.error({ err }, "Failed to register Discord slash commands");
    });

  return client;
}
