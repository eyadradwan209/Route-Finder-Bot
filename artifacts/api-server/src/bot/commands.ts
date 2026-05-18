import {
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";
import { logger } from "../lib/logger";

export const commands = [
  new SlashCommandBuilder()
    .setName("routes")
    .setDescription("Pick 4 random routes departing or arriving at an airport")
    .addStringOption((option) =>
      option
        .setName("airport")
        .setDescription("ICAO airport code (e.g. KORD, EGLL)")
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("addairport")
    .setDescription("Add an airport to the featured airports list")
    .addStringOption((option) =>
      option
        .setName("code")
        .setDescription("ICAO airport code (e.g. KORD)")
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("removeairport")
    .setDescription("Remove an airport from the featured airports list")
    .addStringOption((option) =>
      option
        .setName("code")
        .setDescription("ICAO airport code (e.g. KORD)")
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("listairports")
    .setDescription("List all featured airports")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("routecount")
    .setDescription("Show total number of routes in the database")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("setschedule")
    .setDescription("Set the channel for daily 0000Z route posts")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The text channel to post daily routes in")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("unsetschedule")
    .setDescription("Stop the daily 0000Z route posts")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("testschedule")
    .setDescription("Trigger today's route post immediately (for testing)")
    .toJSON(),
];

export async function registerCommands() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  const clientId = process.env["DISCORD_CLIENT_ID"];

  if (!token || !clientId) {
    throw new Error("DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set");
  }

  const rest = new REST({ version: "10" }).setToken(token);

  logger.info("Registering Discord slash commands...");
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  logger.info("Discord slash commands registered");
}
