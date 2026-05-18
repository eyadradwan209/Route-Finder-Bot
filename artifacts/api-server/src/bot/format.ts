import type { Route } from "@workspace/db";

export function formatRoute(r: Route): string {
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

  return [prefix, route, aircraft, duration].filter(Boolean).join(" | ");
}
