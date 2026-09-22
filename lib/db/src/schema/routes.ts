import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const routesTable = pgTable("routes", {
  id: serial("id").primaryKey(),
  origin: text("origin").notNull(),
  originCity: text("origin_city"),
  originFlag: text("origin_flag"),
  destination: text("destination").notNull(),
  destinationCity: text("destination_city"),
  destinationFlag: text("destination_flag"),
  airline: text("airline"),
  airlineEmoji: text("airline_emoji"),
  flightNumber: text("flight_number"),
  aircraft: text("aircraft"),
  duration: text("duration"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRouteSchema = createInsertSchema(routesTable).omit({ id: true, createdAt: true });
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routesTable.$inferSelect;
