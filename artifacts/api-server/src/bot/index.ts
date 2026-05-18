import {
  Client,
  GatewayIntentBits,
  Interaction,
  ChatInputCommandInteraction,
} from "discord.js";
import { db } from "@workspace/db";
import { routesTable } from "@workspace/db";
import type { Route } from "@workspace/db";
import { or, ilike } from "drizzle-orm";
import { logger } from "../lib/logger";
import { registerCommands } from "./commands";
import { addAirport, removeAirport, listAirports } from "./airports";

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function formatRoute(r: Route): string {
  const emoji = r.airlineEmoji ? `:${r.airlineEmoji}:` : "";
  const flight = r.flightNumber ?? "";
  const prefix = [emoji, flight].filter(Boolean).join(" ");

  const originCity = r.originCity ?? "";
  const originFlag = r.originFlag ?? "";
  const originPart = `${originCity}${originFlag ? " " + originFlag : ""}(${r.origin})`;

  const destCity = r.destinationCity ?? "";
  const destFlag = r.destinationFlag ?? "";
  const destPart = `${destCity}${destFlag ? " " + destFlag : ""}(${r.destination})`;

  const route = `${originPart} —> ${destPart}`;
  const aircraft = r.aircraft ?? "";
  const duration = r.duration ?? "";

  const parts = [prefix, route, aircraft, duration].filter(Boolean);
  return parts.join(" | ");
}

async function handleRoutes(interaction: ChatInputCommandInteraction) {
  const airport = interaction.options.getString("airport", true).toUpperCase().trim();
  await interaction.deferReply();

  const matching = await db
    .select()
    .from(routesTable)
    .where(or(ilike(routesTable.origin, airport), ilike(routesTable.destination, airport)));

  if (matching.length === 0) {
    await interaction.editReply(
      `No routes found departing or arriving at **${airport}**. Make sure the airport code is correct and routes have been imported.`
    );
    return;
  }

  const picked = pickRandom(matching, Math.min(4, matching.length));
  const lines = picked.map((r) => formatRoute(r));

  await interaction.editReply(
    `✈️ **${picked.length} random routes for ${airport}** (${matching.length} total):\n\n${lines.join("\n")}`
  );
}

async function handleAddAirport(interaction: ChatInputCommandInteraction) {
  const code = interaction.options.getString("code", true).toUpperCase().trim();
  const added = addAirport(code);
  if (added) {
    await interaction.reply(`✅ **${code}** added to featured airports.`);
  } else {
    await interaction.reply(`**${code}** is already in the featured airports list.`);
  }
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
  await interaction.reply(`🛫 **Featured airports** (${airports.length}):\n${airports.join(", ")}`);
}

async function handleRouteCount(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const rows = await db.select({ id: routesTable.id }).from(routesTable);
  await interaction.editReply(`📊 There are **${rows.length}** routes in the database.`);
}

async function handleInteraction(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;
  try {
    switch (interaction.commandName) {
      case "routes":       await handleRoutes(interaction); break;
      case "addairport":   await handleAddAirport(interaction); break;
      case "removeairport":await handleRemoveAirport(interaction); break;
      case "listairports": await handleListAirports(interaction); break;
      case "routecount":   await handleRouteCount(interaction); break;
      default: await interaction.reply("Unknown command.");
    }
  } catch (err) {
    logger.error({ err, command: interaction.commandName }, "Error handling Discord command");
    const msg = "An error occurred while processing that command.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
}

export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) throw new Error("DISCORD_BOT_TOKEN is required");

  await registerCommands();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once("ready", (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot is ready");
  });

  client.on("interactionCreate", handleInteraction);
  await client.login(token);
  return client;
}
