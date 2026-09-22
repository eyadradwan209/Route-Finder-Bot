import type { Client } from "discord.js";
import type { Route } from "@workspace/db";

function flagToEmoji(flag: string): string {
  const match = flag.match(/^flag_([a-z]{2})$/i);
  if (!match) return `:${flag}:`;
  const code = match[1].toUpperCase();
  return [...code]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function resolveEmoji(client: Client, name: string): string {
  const found = client.emojis.cache.find((e) => e.name === name);
  return found ? found.toString() : `:${name}:`;
}

export function formatRoute(r: Route, client: Client): string {
  const emoji = r.airlineEmoji ? resolveEmoji(client, r.airlineEmoji) : "";
  const flight = r.flightNumber ?? "";
  const prefix = [emoji, flight].filter(Boolean).join(" ");

  const originCity = r.originCity ?? "";
  const originFlag = r.originFlag ? flagToEmoji(r.originFlag) : "";
  const originPart = `${originCity}${originFlag ? " " + originFlag : ""}(${r.origin})`;

  const destCity = r.destinationCity ?? "";
  const destFlag = r.destinationFlag ? flagToEmoji(r.destinationFlag) : "";
  const destPart = `${destCity}${destFlag ? " " + destFlag : ""}(${r.destination})`;

  const route = `${originPart} —> ${destPart}`;
  const aircraft = r.aircraft ?? "";
  const duration = r.duration ?? "";

  return [prefix, route, aircraft, duration].filter(Boolean).join(" | ");
}
